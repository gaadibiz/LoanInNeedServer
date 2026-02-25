const cron = require('node-cron');
const logger = require('../utils/logger');
const { processPendingIntegrations } = require('../services/losIntegrationService');

/**
 * Initializes the background worker for pushing data to LOS.
 * Runs every minute to sweep the `LosIntegrationJob` queue.
 */
const startLosWorker = () => {
    logger.info('[LOS WORKER] Initializing Cron Job (runs every minute)...');

    cron.schedule('* * * * *', async () => {
        try {
            await processPendingIntegrations();
        } catch (error) {
            logger.error(`[LOS WORKER] Fatal error in chron cycle: ${error.message}`);
        }
    });
};

module.exports = {
    startLosWorker
};
