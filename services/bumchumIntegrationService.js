const prisma = require('../utils/prismaClient');
const logger = require('../utils/logger');
const { sendLoanApplicationToBumchum, updateLoanApplicationToBumchum, checkAndPushBumchumIfReady } = require('./loanService');

let isProcessing = false;

/**
 * Sweeps for loan applications where `bumchumSyncedAt` is null and pushes them
 * to Bumchum with a 20-second pacing interval between individual requests.
 * If the application's status is non-PENDING, it immediately follows up with
 * `updateLoanApplicationToBumchum` to mirror the actual status on Bumchum.
 */
const processPendingBumchumSync = async (options = {}) => {
    const intervalMs = options.intervalMs || 20000; // 20 seconds default
    const batchSize = options.batchSize || undefined; // Process all pending if batchSize not specified

    if (isProcessing) {
        logger.debug('[BUMCHUM WORKER] Previous sync run is still in progress. Skipping cycle.');
        return;
    }

    isProcessing = true;

    try {
        const applications = await prisma.loanApplication.findMany({
            where: {
                bumchumSyncedAt: null
            },
            orderBy: { createdAt: 'asc' },
            take: batchSize,
            distinct: ['userId'],
            select: {
                userId: true
            }
        });

        if (!applications || applications.length === 0) {
            logger.info('[BUMCHUM WORKER] No pending unsynced applications found.');
            return;
        }

        logger.info(`[BUMCHUM WORKER] Found ${applications.length} unsynced application(s). Processing with ${intervalMs / 1000}s pacing...`);

        for (let i = 0; i < applications.length; i++) {
            const app = applications[i];
            const currentIndex = i + 1;

            try {
                logger.info(`[BUMCHUM WORKER] Syncing for user : `, app.userId);
                // 1. Send application to Bumchum
                await checkAndPushBumchumIfReady(app.userId);

            } catch (err) {
                logger.error(`[BUMCHUM WORKER] failed syncing for user : `, app.userId, err);
            }

            // Pacing interval: wait 20 seconds between individual applications (skip after last item)
            if (currentIndex < applications.length) {
                await new Promise(resolve => setTimeout(resolve, intervalMs));
            }
        }
    } catch (error) {
        logger.error(`[BUMCHUM WORKER] Uncaught error in processPendingBumchumSync: ${error.message}`);
    } finally {
        isProcessing = false;
    }
};

module.exports = {
    processPendingBumchumSync
};
