const prisma = require('../utils/prismaClient');
const logger = require('../utils/logger');
const { buildFinnauxPayload } = require('../config/finnauxMapping');
const { sendApplicationToFinnaux } = require('./finnauxApiClient');

// Maximum times a job will be attempted before marking as permanently FAILED
const MAX_FAILURES = 7;

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

    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            employment: true,
            address: true,
            panVerification: true,
            aadhaarVerification: true,
            phonePrefillDetail: true
        }
    });

    const employee = await prisma.employmentDetail.findUnique({
        where: { userId },
        select: { monthlyIncome: true }
    }) || {};

    const application = await prisma.loanApplication.findUnique({
        where: { id: applicationId }
    });

    const latestLocation = await prisma.userLocation.findFirst({
        where: { userId },
        orderBy: { capturedAt: 'desc' }
    });

    if (!user) {
        throw new Error('User record not found in database.');
    }
    if (!application || !application.loanAmount || application.loanAmount <= 0) {
        throw new Error('Valid loan amount is required for the Finnaux push.');
    }

    const phonePrefillData = user.phonePrefillDetail?.response || {};

    const payload = buildFinnauxPayload(
        application,
        user,
        user.employment || null,
        user.address || null,
        user.panVerification || null,
        user.aadhaarVerification || null,
        employee,
        phonePrefillData,
        latestLocation,
        ipAddress
    );

    await prisma.finnauxIntegrationJob.update({
        where: { id },
        data: { rawRequest: JSON.parse(JSON.stringify(payload)) }
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

module.exports = {
    processPendingFinnauxIntegrations,
    processSingleFinnauxJob
};
