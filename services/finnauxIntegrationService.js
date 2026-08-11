const prisma = require('../utils/prismaClient');
const logger = require('../utils/logger');
const { buildFinnauxPayload } = require('../config/finnauxMapping');
const { sendApplicationToFinnaux } = require('./finnauxApiClient');
const { default: axios } = require('axios');

// Maximum times a job will be attempted before marking as permanently FAILED
const MAX_FAILURES = 7;

// Cap on concurrent payload builds so a large date-range export doesn't fire
// hundreds of simultaneous document downloads at DigitalOcean Spaces.
const PAYLOAD_BUILD_CONCURRENCY = 10;

/**
 * Runs `mapper` over `items` with at most `limit` in flight at once.
 */
const mapWithConcurrency = async (items, limit, mapper) => {
    const results = new Array(items.length);
    let nextIndex = 0;

    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (nextIndex < items.length) {
            const currentIndex = nextIndex++;
            results[currentIndex] = await mapper(items[currentIndex], currentIndex);
        }
    });

    await Promise.all(workers);
    return results;
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Core processor run by the cron worker (finnauxWorker.js)
 * Picks up PENDING jobs and FAILED jobs that are still under the retry limit.
 * Uses the same exponential backoff windows as the LOS integration.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const processPendingFinnauxIntegrations = async () => {
    logger.info('[FINNAUX WORKER] Checking for pending Finnaux integration jobs...');

    const now = new Date();
    const minus5m = new Date(now.getTime() - 5 * 60 * 1000);
    const minus30m = new Date(now.getTime() - 30 * 60 * 1000);
    const minus2h = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const minus12h = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    const minus24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const jobs = await prisma.finnauxIntegrationJob.findMany({
        where: {
            OR: [
                { status: 'PENDING' },
                { status: 'FAILED', retryCount: 1, updatedAt: { lte: minus5m } },
                { status: 'FAILED', retryCount: 2, updatedAt: { lte: minus30m } },
                { status: 'FAILED', retryCount: 3, updatedAt: { lte: minus2h } },
                { status: 'FAILED', retryCount: 4, updatedAt: { lte: minus12h } },
                { status: 'FAILED', retryCount: { gte: 5, lt: MAX_FAILURES }, updatedAt: { lte: minus24h } }
            ]
        },
        orderBy: { createdAt: 'asc' },
        take: 50
    });

    if (jobs.length === 0) {
        logger.info('[FINNAUX WORKER] No pending jobs found.');
        return;
    }

    logger.info(`[FINNAUX WORKER] Found ${jobs.length} job(s). Processing with 500ms pacing...`);

    for (const job of jobs) {
        try {
            await processSingleFinnauxJob(job);
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
            logger.error(`[FINNAUX WORKER] Uncaught error processing job ${job.id}: ${error.message}`, {
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
 * Gathers every source record for a user/application and builds the current,
 * correct Finnaux payload. Shared by job processing (below) and by the job
 * creation sites (loanService.js, kycService.js) so a job's rawRequest is
 * always in the right shape — whether it's the initial snapshot at insert
 * time or the one written right before the actual send.
 *
 * Accepts an optional Prisma client so callers running inside a `$transaction`
 * (e.g. kycService.js's `tx`) can reuse this against the same transaction.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const buildFinnauxJobPayload = async (userId, applicationId, ipAddress, client = prisma) => {
    const user = await client.user.findUnique({
        where: { id: userId },
        select: {
            name: true,
            email: true,
            phone: true,
            dob: true,
            gender: true,
            verificationStatus: true,
            phoneVerified: true,
            phonePrefillDetail: {
                select: { response: true }
            },
        }
    });

    const employee = await client.employmentDetail.findUnique({
        where: { userId },
        select: {
            monthlyIncome: true,
            employerName: true,
            employmentType: true,
            companyAddress: true,
        }
    }) || {};

    const business = await client.businessDetail.findUnique({
        where: { userId },
        select: {
            firmName: true,
            gstNumber: true,
            tradeLicense: true,
            companyPan: true,
            address: true,
            city: true,
            state: true,
            pincode: true,
        }
    }) || {};

    const application = await client.loanApplication.findUnique({
        where: { id: applicationId },
        select: {
            id: true,
            loanType: true,
            loanAmount: true,
            employeeName: true,
            loanAccountNumber: true,
            losApplicationNumber: true,
            reason: true,
            reloan: true,
            status: true,
            createdAt: true,
            updatedAt: true
        }
    });

    const latestLocation = await client.userLocation.findFirst({
        where: { userId },
        orderBy: { capturedAt: 'desc' },
        select: {
            locality: true,
            city: true,
            state: true,
            postalCode: true,
            latitude: true,
            longitude: true,
        }
    });

    const userDocuments = await client.userDocument.findMany({
        where: { userId },
        select: {
            id: true,
            docType: true,
            fileName: true,
            filePath: true,
            fileUrl: true
        }
    });

    const address = await client.addressDetail.findUnique({
        where: { userId },
        select: {
            currentAddress: true,
            permanentAddress: true,
            city: true,
            state: true,
            postalCode: true,
            currentAddressType: true,
        }
    });

    const aadhaarVerification = await client.aadhaarVerification.findUnique({
        where: { userId },
        select: {
            aadhaarNumber: true,
            verified: true,
            verifiedAt: true,
            address: true,
            dob: true,
        }
    });

    const panVerification = await client.panVerification.findUnique({
        where: { userId },
        select: {
            panNumber: true,
            verified: true,
        }
    });

    if (!user) {
        throw new Error('User record not found in database.');
    }

    let utm = await prisma.utm.findUnique({
        where: { userId },
        select: {
            utmSource: true,
            utmMedium: true,
            utmCampaign: true,
            utmId: true,
            utmTerm: true,
            utmContent: true,
        }
    });

    const phonePrefillData = user.phonePrefillDetail?.response || {};
    return buildFinnauxPayload(
        application,
        user,
        employee,
        business,
        address,
        aadhaarVerification,
        phonePrefillData,
        latestLocation,
        panVerification,
        ipAddress,
        utm
    );
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Processes a single Finnaux integration job:
 *   1. Fetch user + application data from LIN database
 *   2. Build the Finnaux payload
 *   3. Push to Finnaux via HTTP POST
 *   4. Store the Finnaux reference on success
 * ─────────────────────────────────────────────────────────────────────────────
 */
const processSingleFinnauxJob = async (job) => {
    const { id, userId, applicationId, ipAddress } = job;
    logger.info(`[FINNAUX WORKER] Processing Job ID: ${id} | User: ${userId} | App: ${applicationId}`);

    let userDocuments = await prisma.userDocument.findMany({
        where: { userId },
        select: {
            id: true,
            docType: true,
        },
        orderBy: { uploadedAt: 'desc' }
    });

    const application = await prisma.loanApplication.findUnique({
        where: { id: applicationId },
        select: { loanAmount: true }
    });
    if (!application || !application.loanAmount || application.loanAmount <= 0) {
        throw new Error('Valid loan amount is required for the Finnaux push.');
    }

    const payload = await buildFinnauxJobPayload(userId, applicationId, ipAddress);

    let updated_documents = {}

    userDocuments.forEach(doc => {
        if (doc.docType === 'AADHAAR' && !updated_documents.aadharDocumentId) {
            updated_documents.aadharDocumentId = doc.id
        }
        if (doc.docType === 'PAN' && !updated_documents.panDocumentId) {
            updated_documents.panDocumentId = doc.id
        }
        if (doc.docType === 'PAY_SLIP' && !updated_documents.salarySlipDocumentId) {
            updated_documents.salarySlipDocumentId = doc.id
        }
        if (doc.docType === 'BANK_STATEMENT' && !updated_documents.bankStatementDocumentId) {
            updated_documents.bankStatementDocumentId = doc.id
        }
    })

    await prisma.finnauxIntegrationJob.update({
        where: { id },
        data: { ...updated_documents, rawRequest: JSON.parse(JSON.stringify(payload)) }
    });

    const finnauxResponse = await sendApplicationToFinnaux(payload);

    if (finnauxResponse.success) {
        logger.info(`[FINNAUX WORKER] ✅ Job ${id} pushed successfully. ReferenceId: ${finnauxResponse.referenceId || 'N/A'}`);

        await prisma.finnauxIntegrationJob.update({
            where: { id },
            data: {
                status: 'SUCCESS',
                finnauxReferenceId: finnauxResponse.referenceId ? String(finnauxResponse.referenceId) : null,
                rawResponse: finnauxResponse.rawData ? JSON.parse(JSON.stringify(finnauxResponse.rawData)) : null,
                lastError: null
            }
        });
    } else {
        throw new Error('Finnaux responded with success=false or an unexpected body.');
    }
};

/**
 * Marks a job as FAILED and increments the retry counter.
 * Once retryCount >= MAX_FAILURES, the cron worker will no longer pick it up.
 */
const markJobFailed = async (job, errorMessage) => {
    const newRetryCount = (job.retryCount || 0) + 1;

    await prisma.finnauxIntegrationJob.update({
        where: { id: job.id },
        data: {
            status: 'FAILED',
            retryCount: newRetryCount,
            lastError: errorMessage
        }
    });

    if (newRetryCount >= MAX_FAILURES) {
        logger.error(
            `[FINNAUX WORKER] 🚨 Job ${job.id} has EXHAUSTED all ${MAX_FAILURES} retries. ` +
            `Manual intervention required. Last error: ${errorMessage}`
        );
    } else {
        logger.warn(
            `[FINNAUX WORKER] Job ${job.id} failed (attempt ${newRetryCount}/${MAX_FAILURES}). ` +
            `Will retry on next cron cycle. Error: ${errorMessage}`
        );
    }
};

const getBase64Documents = async (id) => {
    let documentsInfo = await prisma.finnauxIntegrationJob.findUnique({
        where: { applicationId: parseInt(id) }, select: {
            userId: true,
            aadharDocumentId: true,
            panDocumentId: true,
            salarySlipDocumentId: true,
            bankStatementDocumentId: true,
        }
    });
    console.log(documentsInfo);

    if (!documentsInfo) {
        throw new NotFoundError(`Finnaux integration job not found for applicationId: ${id}`);
    }
    let userDocuments = [];

    if (!documentsInfo.aadharDocumentId || !documentsInfo.panDocumentId || !documentsInfo.salarySlipDocumentId || !documentsInfo.bankStatementDocumentId) {
        userDocuments = await prisma.userDocument.findMany({
            where: {
                userId: documentsInfo.userId
            },
            select: {
                docType: true,
                fileName: true,
                fileUrl: true,
                uploadedAt: true,
            },
            orderBy: {
                uploadedAt: 'desc'
            },
            distinct: ['docType']
        });
    } else {
        userDocuments = await prisma.userDocument.findMany({
            where: {
                id: {
                    in: [
                        documentsInfo.aadharDocumentId,
                        documentsInfo.panDocumentId,
                        documentsInfo.salarySlipDocumentId,
                        documentsInfo.bankStatementDocumentId
                    ].filter(Boolean)
                }
            },
            select: {
                docType: true,
                fileName: true,
                fileUrl: true,
            },
            orderBy: { uploadedAt: 'desc' }
        });
    }

    let documentBase64 = {}
    await Promise.all(userDocuments.map(async (doc) => {
        let base64Data = null;
        let doctype = doc.docType === 'AADHAAR' ? 'aadhaarFront' : doc.docType === 'PAN' ? 'panCard' : doc.docType === 'PAY_SLIP' ? 'salarySlips' : doc.docType === 'BANK_STATEMENT' ? 'bankStatement' : doc.docType;
        try {
            if (doc.fileUrl && !documentBase64[doctype]) {
                const response = await axios.get(doc.fileUrl, { responseType: 'arraybuffer' });
                base64Data = Buffer.from(response.data, 'binary').toString('base64');
                if (!base64Data) return null;
                documentBase64[doctype] = doctype === 'salarySlips' ? [[base64Data, doc.fileName || null]] : [base64Data, doc.fileName || null];
            }
            return null;
        } catch (err) {
            logger.error(`[FINNAUX] Failed to encode document ${doc.id} (${doc.docType}): ${err.message}`);
            return null;
        }
    }));
    return documentBase64
}

module.exports = {
    processPendingFinnauxIntegrations,
    processSingleFinnauxJob,
    buildFinnauxJobPayload,
    getBase64Documents
};
