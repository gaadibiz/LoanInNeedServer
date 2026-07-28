const cron = require('node-cron');
const logger = require('../utils/logger');
const { processPendingFinnauxIntegrations } = require('../services/finnauxIntegrationService');

/**
 * Initializes the background worker for pushing data to Finnaux.
 * Runs every minute to sweep the `FinnauxIntegrationJob` queue.
 */
const startFinnauxWorker = () => {
    logger.info('[FINNAUX WORKER] Initializing Cron Job (runs every minute)...');

    cron.schedule('* * * * *', async () => {
        try {
            await processPendingFinnauxIntegrations();
        } catch (error) {
            logger.error(`[FINNAUX WORKER] Fatal error in cron cycle: ${error.message}`);
        }
    });
};

module.exports = {
    startFinnauxWorker
};
