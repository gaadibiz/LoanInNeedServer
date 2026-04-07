const prisma = require('../utils/prismaClient');
const logger = require('../utils/logger');
const { buildLosPayload } = require('../config/losMapping');
const { createLosApplication } = require('./losApiClient');

// Maximum times a job will be attempted before marking as permanently FAILED
const MAX_FAILURES = 3;

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Core processor run by the cron worker (losWorker.js)
 * Picks up PENDING jobs and FAILED jobs that are still under the retry limit.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const processPendingIntegrations = async () => {
    logger.info('[LOS WORKER] Checking for pending LOS integration jobs...');

    const jobs = await prisma.losIntegrationJob.findMany({
        where: {
            OR: [
                { status: 'PENDING' },
                {
                    status: 'FAILED',
                    retryCount: { lt: MAX_FAILURES }
                }
            ]
        },
        orderBy: { createdAt: 'asc' }, // oldest first
        take: 10                        // process in batches of 10
    });

    if (jobs.length === 0) {
        logger.info('[LOS WORKER] No pending jobs found.');
        return;
    }

    logger.info(`[LOS WORKER] Found ${jobs.length} job(s). Processing...`);

    for (const job of jobs) {
        try {
            await processSingleJob(job);
        } catch (error) {
            logger.error(`[LOS WORKER] Uncaught error processing job ${job.id}: ${error.message}`);
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
    const { id, userId, applicationId } = job;
    logger.info(`[LOS WORKER] Processing Job ID: ${id} | User: ${userId} | App: ${applicationId}`);

    // ── 1. Fetch records from LIN DB ─────────────────────────────────────────
    const user = await prisma.user.findUnique({
        where: { id: userId }
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

    // ── 3. Fetch KYC data from LIN DB ────────────────────────────────────────
    const kycEmployment = await prisma.kycEmployment.findFirst({ where: { userId } }).catch(() => null);
    const kycAddress    = await prisma.kycAddress.findFirst({ where: { userId } }).catch(() => null);
    const kycPan        = await prisma.kycPan.findFirst({ where: { userId } }).catch(() => null);

    // ── 4. Build the full LOS v1 payload ────────────────────────────────────
    const payload = buildLosPayload(application, user, kycEmployment, kycAddress, kycPan);

    logger.info(`[LOS WORKER] Payload built for applicationId: ${applicationId}`, {
        customer: `${payload.FirstName} ${payload.LastName}`,
        amount:   payload.LoanAmountRequired
    });

    // ── 5. Push to LOS ───────────────────────────────────────────────────────
    const losResponse = await createLosApplication(payload);

    // ── 6. Mark success and store the LOS IDs ────────────────────────────────
    if (losResponse.success) {
        logger.info(`[LOS WORKER] ✅ Job ${id} pushed successfully. ApplicationId: ${losResponse.applicationId}, CaseNumber: ${losResponse.caseNumber}`);

        await prisma.losIntegrationJob.update({
            where: { id },
            data: {
                status:           'SUCCESS',
                losApplicationId: losResponse.applicationId || null,
                losCaseNumber:    losResponse.caseNumber    || null,
                lastError:        null
            }
        });
    } else {
        throw new Error('LOS responded with success=false or an unexpected body.');
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
    processPendingIntegrations
};
