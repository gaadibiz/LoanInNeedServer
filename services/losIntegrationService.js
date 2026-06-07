const prisma = require('../utils/prismaClient');
const logger = require('../utils/logger');
const { buildNewLosPayload } = require('../config/losMapping');
const { createLosApplication, pushKycDocumentToLos } = require('./losApiClient');
const path = require('path');
const axios = require('axios');
const { encodeFileToBase64 } = require('../utils/base64Encoder');

// Maximum times a job will be attempted before marking as permanently FAILED
const MAX_FAILURES = 7;

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Core processor run by the cron worker (losWorker.js)
 * Picks up PENDING jobs and FAILED jobs that are still under the retry limit.
 * Uses Exponential Backoff to prevent spamming the LOS during an outage.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const processPendingIntegrations = async () => {
    logger.info('[LOS WORKER] Checking for pending LOS integration jobs...');

    const now = new Date();
    const minus5m = new Date(now.getTime() - 5 * 60 * 1000);
    const minus30m = new Date(now.getTime() - 30 * 60 * 1000);
    const minus2h = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const minus12h = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    const minus24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const jobs = await prisma.losIntegrationJob.findMany({
        where: {
            OR: [
                { status: 'PENDING' },
                { status: 'PUSHING_DOCUMENTS', updatedAt: { lte: minus30m } },
                { status: 'FAILED', retryCount: 1, updatedAt: { lte: minus5m } },
                { status: 'FAILED', retryCount: 2, updatedAt: { lte: minus30m } },
                { status: 'FAILED', retryCount: 3, updatedAt: { lte: minus2h } },
                { status: 'FAILED', retryCount: 4, updatedAt: { lte: minus12h } },
                { status: 'FAILED', retryCount: { gte: 5, lt: MAX_FAILURES }, updatedAt: { lte: minus24h } }
            ]
        },
        orderBy: { createdAt: 'asc' }, // oldest first
        take: 50                        // process in batches of 50 to catch up efficiently
    });

    if (jobs.length === 0) {
        logger.info('[LOS WORKER] No pending jobs found.');
        return;
    }

    logger.info(`[LOS WORKER] Found ${jobs.length} job(s). Processing with 500ms pacing...`);

    for (const job of jobs) {
        try {
            await processSingleJob(job);
            
            // Pacing: 500ms delay between requests to avoid DDoSing System B (Thundering Herd Protection)
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
            logger.error(`[LOS WORKER] Uncaught error processing job ${job.id}: ${error.message}`, {
                jobId: job.id,
                userId: job.userId,
                applicationId: job.applicationId
            });
            await markJobFailed(job, error.message);
        }
    }
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Processes a single LOS integration job:
 *   1. Fetch user + application data from LIN database
 *   2. Validate required fields
 *   3. Build the LOS API payload (new v2 format)
 *   4. Push to LOS via HTTP POST
 *   5. Store the LOS referenceId on success
 * ─────────────────────────────────────────────────────────────────────────────
 */
const processSingleJob = async (job) => {
    const { id, userId, applicationId, losApplicationId, losCaseNumber, losKycId } = job;
    logger.info(`[LOS WORKER] Processing Job ID: ${id} | User: ${userId} | App: ${applicationId}`);

    // ── 1. Fetch records from LIN DB ─────────────────────────────────────────
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            employment: true,
            address: true,
            panVerification: true,
            aadhaarVerification: true
        }
    });

    const application = await prisma.loanApplication.findUnique({
        where: { id: applicationId }
    });

    // ── 2. Validate required fields ──────────────────────────────────────────
    if (!user) {
        throw new Error('User record not found in database.');
    }
    if (!user.phone) {
        throw new Error('Customer mobile number is missing. LOS requires a valid mobile number.');
    }
    if (!application || !application.loanAmount || application.loanAmount <= 0) {
        throw new Error('Valid loan amount is required. LOS will reject a zero-amount application.');
    }
    if (!user.name) {
        throw new Error('Customer name is missing. LOS requires firstName and lastName.');
    }

    // ── 2b. Defer if Aadhaar not yet verified (race condition guard) ─────────
    // The LOS job is queued during KYC submission, but Aadhaar verify-otp is a
    // separate parallel request that may complete AFTER the job is queued.
    if (!user.aadhaarVerification || !user.aadhaarVerification.aadhaarNumber) {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        if (job.createdAt < oneHourAgo) {
            // It's been waiting for Aadhaar for over an hour. The user likely abandoned the flow.
            throw new Error('Aadhaar verification was never completed (timed out after 1 hour).');
        }

        // Instead of failing, we skip this cycle and let the retry pick it up.
        logger.warn(
            `[LOS WORKER] ⏳ Job ${id} deferred — Aadhaar not yet verified for userId ${userId}. ` +
            'Will retry on next cron cycle once Aadhaar verification completes.'
        );
        return; // Keep job in current state — cron will retry next cycle
    }

    // ── 3. Map KYC data from LIN DB ──────────────────────────────────────────
    const kycEmployment = user.employment || null;
    const kycAddress    = user.address || null;
    const panVerification = user.panVerification || null;
    const aadhaarVerification = user.aadhaarVerification || null;

    let currentLosAppId = losApplicationId;
    let currentLosCaseNumber = losCaseNumber;
    let currentLosKycId = losKycId;

    if (!currentLosAppId) {
        // ── 4. Build the new LOS payload (confirmed contract, June 2026) ─────
        const payload = buildNewLosPayload(application, user, kycEmployment, kycAddress, panVerification, aadhaarVerification);

        logger.info(`[LOS WORKER] Payload built for applicationId: ${applicationId}`, {
            customer: `${payload.FirstName} ${payload.LastName}`,
            amount:   payload.LoanAmountRequired
        });

        // Update job with rawRequest before sending
        await prisma.losIntegrationJob.update({
            where: { id },
            data: { rawRequest: JSON.parse(JSON.stringify(payload)) }
        });

        // ── 5. Push to LOS (Phase 1) ───────────────────────────────────────────────────────
        const losResponse = await createLosApplication(payload);

        if (losResponse.success) {
            currentLosAppId = losResponse.applicationId ? losResponse.applicationId.toString() : null;
            currentLosCaseNumber = losResponse.caseNumber ? losResponse.caseNumber.toString() : null;
            currentLosKycId = losResponse.kycId ? losResponse.kycId.toString() : null;

            logger.info(`[LOS WORKER] ✅ Job ${id} Phase 1 pushed successfully. ApplicationId: ${currentLosAppId}, CaseNumber: ${currentLosCaseNumber}, LoanEnquiryID: ${losResponse.loanEnquiryId || 'N/A'}, KYCID: ${currentLosKycId}`);

            await prisma.losIntegrationJob.update({
                where: { id },
                data: {
                    status:           'PUSHING_DOCUMENTS',
                    losApplicationId: currentLosAppId,
                    losCaseNumber:    currentLosCaseNumber,
                    losKycId:         currentLosKycId,
                    rawResponse:      losResponse.rawData ? JSON.parse(JSON.stringify(losResponse.rawData)) : null,
                    lastError:        null
                }
            });

            await prisma.loanApplication.update({
                where: { id: applicationId },
                data: {
                    losApplicationNumber: currentLosCaseNumber
                }
            });
        } else {
            throw new Error('LOS responded with success=false or an unexpected body during Phase 1.');
        }
    } else {
        logger.info(`[LOS WORKER] Phase 1 Skipped for Job ${id} (losApplicationId ${currentLosAppId} already exists). Proceeding to Phase 2.`);
        // Update status to PUSHING_DOCUMENTS if it was FAILED
        await prisma.losIntegrationJob.update({
            where: { id },
            data: {
                status: 'PUSHING_DOCUMENTS',
                lastError: null
            }
        });
    }

    // ── 6. Push KYC Documents (Phase 2) ──────────────────────────────
    try {
        const userDocuments = await prisma.userDocument.findMany({ where: { userId } });
        if (userDocuments && userDocuments.length > 0) {
            logger.info(`[LOS WORKER] Found ${userDocuments.length} documents for ApplicationId: ${currentLosAppId}`);
            const documentsArray = [];
            const { documentTypeMap } = require('../config/losMapping');
            for (const doc of userDocuments) {
                try {
                    let base64Data = '';
                    if (doc.fileUrl) {
                        const response = await axios.get(doc.fileUrl, { responseType: 'arraybuffer' });
                        base64Data = Buffer.from(response.data, 'binary').toString('base64');
                    } else {
                        const absolutePath = path.join(__dirname, '..', doc.filePath);
                        base64Data = encodeFileToBase64(absolutePath, false);
                    }

                    let proofNumber = '';
                    if (doc.docType === 'PAN' && panVerification) {
                        proofNumber = panVerification.panNumber;
                    } else if (doc.docType === 'AADHAAR' && user.aadhaarVerification) {
                        proofNumber = user.aadhaarVerification.aadhaarNumber;
                    } else {
                        proofNumber = user.phone;
                    }

                    const mapInfo = documentTypeMap[doc.docType] || { DocID: 0, DocTypeID: 0 };
                    
                    if (mapInfo.DocID > 0) {
                        documentsArray.push({
                            ProofID: 0,
                            OrganizationID: 0,
                            KYCID: parseInt(currentLosKycId) || 0,
                            ApplicationID: parseInt(currentLosAppId) || 0,
                            DocTypeID: mapInfo.DocTypeID,
                            DocID: mapInfo.DocID,
                            AttachmentID: 0,
                            BranchID: 0,
                            AgencyDocVerID: 0,
                            AgencyID: 0,
                            GuarantorID: 0,
                            DocNumber: proofNumber,
                            DocPerson: "",
                            IssuingAuth: "",
                            ValidTill: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString(),
                            IsMandatory: true,
                            FileName: doc.fileName || `${doc.docType.toLowerCase()}.pdf`,
                            FilePath: "",
                            AssignToEMP: "",
                            IsNewFile: true,
                            UserImageBase64: base64Data
                        });
                    }
                } catch (docErr) {
                    logger.warn(`[LOS WORKER] Failed to process document ${doc.id} (${doc.docType}): ${docErr.message}`);
                }
            }

            if (documentsArray.length > 0) {
                try {
                    logger.info(`[LOS WORKER] Attempting to push ${documentsArray.length} KYC documents together.`);
                    // Send all documents in a single array payload
                    const kycResponse = await pushKycDocumentToLos(documentsArray);
                    
                    if (kycResponse.success) {
                        logger.info(`[LOS WORKER] ✅ All KYC Documents pushed successfully.`);
                    } else {
                        logger.error(`[LOS WORKER] LOS returned success=false for document push.`);
                        throw new Error('LOS responded with success=false during Phase 2 (Document Push).');
                    }
                } catch (pushErr) {
                    logger.error(`[LOS WORKER] Exception pushing KYC documents: ${pushErr.message}`);
                    throw pushErr; // Rethrow to fail the job immediately
                }
            } else {
                logger.warn(`[LOS WORKER] No valid mapped documents found to push for Job ${id}.`);
            }
        }

        // Only mark SUCCESS if documents were successfully pushed (or no documents to push)
        await prisma.losIntegrationJob.update({
            where: { id },
            data: {
                status: 'SUCCESS',
                lastError: null
            }
        });
    } catch (kycErr) {
        logger.error(`[LOS WORKER] Failed to push KYC documents for Job ${id}: ${kycErr.message}`);
        throw new Error(`Phase 2 Document Push Failed: ${kycErr.message}`);
    }
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Marks a job as FAILED and increments the retry counter.
 * Once retryCount >= MAX_FAILURES, the cron worker will no longer pick it up.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const markJobFailed = async (job, errorMessage) => {
    const newRetryCount = (job.retryCount || 0) + 1;

    await prisma.losIntegrationJob.update({
        where: { id: job.id },
        data: {
            status:     'FAILED',
            retryCount: newRetryCount,
            lastError:  errorMessage
        }
    });

    if (newRetryCount >= MAX_FAILURES) {
        logger.error(
            `[LOS WORKER] 🚨 Job ${job.id} has EXHAUSTED all ${MAX_FAILURES} retries. ` +
            `Manual intervention required. Last error: ${errorMessage}`
        );
    } else {
        logger.warn(
            `[LOS WORKER] Job ${job.id} failed (attempt ${newRetryCount}/${MAX_FAILURES}). ` +
            `Will retry on next cron cycle. Error: ${errorMessage}`
        );
    }
};

module.exports = {
    processPendingIntegrations,
    processSingleJob
};
