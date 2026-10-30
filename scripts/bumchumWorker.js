const cron = require('node-cron');
const logger = require('../utils/logger');
const { processPendingBumchumSync } = require('../services/bumchumIntegrationService');

/**
 * Initializes the background worker for pushing unsynced applications to Bumchum.
 * Runs on a cron cycle (every 1 hour) to sweep applications where `bumchumSyncedAt` is null.
 * Paces individual applications with a 20-second interval as defined in the sync script.
 */
const startBumchumWorker = () => {
    logger.info('[BUMCHUM WORKER] Initializing Cron Job (runs every 1 hour with 20s pacing interval)...');

    cron.schedule('* * * * *', async () => {
        try {
            await processPendingBumchumSync({ intervalMs: 20000 });
        } catch (error) {
            logger.error(`[BUMCHUM WORKER] Fatal error in cron cycle: ${error.message}`);
        }
    }, {
        timezone: 'Asia/Kolkata'
    });
};

// Allow running standalone: node scripts/bumchumWorker.js
if (require.main === module) {
    startBumchumWorker();
}

module.exports = {
    startBumchumWorker
};
