const prisma = require('../utils/prismaClient');
const logger = require('../utils/logger');
const { buildLosPayload } = require('../config/losMapping');
const { createLosApplication } = require('./losApiClient');

// Maximum times a job will be attempted before marking as heavily FAILED
const MAX_FAILURES = 3;

/**
 * Core processor run by the cron worker
 */
const processPendingIntegrations = async () => {
    logger.info('[LOS WORKER] Checking for pending LOS integration jobs...');

    // 1. Fetch PENDING or FAILED (under max retries)
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
        orderBy: {
            createdAt: 'asc' // process oldest first
        },
        take: 10 // batch size
    });

    if (jobs.length === 0) {
        logger.info('[LOS WORKER] No pending jobs found.');
        return;
    }

    logger.info(`[LOS WORKER] Found ${jobs.length} jobs. Processing...`);

    for (const job of jobs) {
        try {
            await processSingleJob(job);
        } catch (error) {
            logger.error(`[LOS WORKER] Uncaught error processing job ${job.id}:`, error);
            await markJobFailed(job, error.message);
        }
    }
};

/**
 * Handles aggregation, mapping, and pushing a single job to LOS
 */
const processSingleJob = async (job) => {
    const { id, userId, applicationId } = job;
    logger.info(`[LOS WORKER] Processing Job ID: ${id} | User: ${userId} | App: ${applicationId}`);

    // 1. Fetch required data from LIN DB
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { address: true, employment: true, panVerification: true }
    });

    const application = await prisma.loanApplication.findUnique({
        where: { id: applicationId }
    });

    // 2. Data Validation
    if (!user) {
        throw new Error("User record not found");
    }
    if (!user.phone) {
        throw new Error("Phone number is missing, LOS requires MobileNo");
    }
    if (!application || application.loanAmount <= 0) {
        throw new Error("Valid loan amount is required");
    }
    if (!user.panVerification || !user.panVerification.panNumber) {
        throw new Error("PAN is missing, LOS requires PanSSN");
    }

    // 3. Transform Data to LOS Format
    const payload = buildLosPayload(
        application,
        user,
        user.employment,
        user.address,
        user.panVerification
    );

    // 4. Send to LOS
    const losResponse = await createLosApplication(payload);

    // 5. Mark Success
    if (losResponse.success) {
        logger.info(`[LOS WORKER] Successfully pushed Job ID: ${id} to LOS.`);
        await prisma.losIntegrationJob.update({
            where: { id },
            data: {
                status: 'SUCCESS',
                losApplicationId: losResponse.applicationId,
                losCaseNumber: losResponse.caseNumber,
                losKycId: losResponse.kycId,
                lastError: null
            }
        });
    } else {
        throw new Error("LOS responded with 200 but success flag was false or missing data.");
    }
};

/**
 * Updates DB on Failure
 */
const markJobFailed = async (job, errorMessage) => {
    const newRetryCount = job.retryCount + 1;
    // Keep it as FAILED. The query `retryCount < MAX` decides if it gets picked up again.

    await prisma.losIntegrationJob.update({
        where: { id: job.id },
        data: {
            status: 'FAILED',
            retryCount: newRetryCount,
            lastError: errorMessage
        }
    });

    if (newRetryCount >= MAX_FAILURES) {
        logger.error(`[LOS WORKER] Job ID: ${job.id} has reached MAX RETRIES (${MAX_FAILURES}). Manual intervention required.`);
    }
};

module.exports = {
    processPendingIntegrations
};
