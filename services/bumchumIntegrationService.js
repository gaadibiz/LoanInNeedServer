const prisma = require('../utils/prismaClient');
const logger = require('../utils/logger');
const { checkAndPushBumchumIfReady, sendLoanApplicationToBumchum } = require('./loanService');

let isProcessing = false;

/**
 * Sweeps for loan applications where `bumchumSyncedAt` is null and all 4 mandatory
 * documents (Aadhaar, PAN, Pay Slip, Bank Statement) exist, then pushes them to
 * Bumchum via checkAndPushBumchumIfReady with a 20-second pacing interval.
 */
const processPendingBumchumSync = async (options = {}) => {
    const intervalMs = options.intervalMs || 20000; // 20 seconds
    const batchSize = 20; // Process all ready if batchSize not specified

    if (isProcessing) {
        logger.debug('[BUMCHUM WORKER] Previous sync run is still in progress. Skipping cycle.');
        return;
    }

    isProcessing = true;

    try {
        const applications = await prisma.loanApplication.findMany({
            where: {
                bumchumSyncedAt: null,
            },
            orderBy: { createdAt: 'desc' },
            take: batchSize,
            distinct: ['userId'],
            select: {
                userId: true,
                id: true
            }
        });

        if (!applications || applications.length === 0) {
            logger.info('[BUMCHUM WORKER] No pending unsynced applications ready with all 4 documents.');
            return;
        }

        logger.info(`[BUMCHUM WORKER] Found ${applications.length} user(s) ready for sync (all 4 documents present). Processing with ${intervalMs / 1000}s pacing...`);

        for (let i = 0; i < applications.length; i++) {
            const app = applications[i];
            const currentIndex = i + 1;

            try {
                logger.info(`[BUMCHUM WORKER] [${currentIndex}/${applications.length}] Syncing for user: ${app.userId}...`);
                // Send application to Bumchum if ready
                await sendLoanApplicationToBumchum(app.userId, app.id);
                await prisma.loanApplication.update({ where: { id: app.id }, data: { bumchumSyncedAt: new Date() } });
                logger.info(`[BUMCHUM WORKER] Synced application for userId=${app.userId} appId=${app.id}`);
            } catch (err) {
                logger.error(`[BUMCHUM WORKER] Failed syncing for user ${app.userId}: ${err?.message || err}`);
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
