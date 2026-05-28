const crypto = require('crypto');
const logger = require('../utils/logger');

// Local fallback state if running without Cluster mode
const localActiveTasks = new Map();

/**
 * Express Middleware to enforce global cluster concurrency limits for specific actions
 * 
 * @param {string} actionName - The unique name for the concurrency pool (e.g., 'LOAN_SUBMISSION')
 * @param {number} maxConcurrent - Absolute maximum concurrent requests allowed across ALL workers
 * @param {string} rejectMessage - The message sent in the 429 response if rejected
 */
const withConcurrencyLimit = (actionName, maxConcurrent, rejectMessage) => {
    // Ensure string action names are correctly mapped for IPC
    const requestCmd = `request${actionName}Slot`;
    const releaseCmd = `release${actionName}Slot`;
    const grantedCmd = `${actionName}SlotGranted`;
    const deniedCmd = `${actionName}SlotDenied`;

    return async (req, res, next) => {
        // If shedding is disabled globally for this action via env, just continue
        const envKey = `ENABLE_${actionName}_LOAD_SHEDDING`;
        if (process.env[envKey] === 'false') {
            return next();
        }

        const maxLimit = process.env[`MAX_CONCURRENT_${actionName}`] 
            ? parseInt(process.env[`MAX_CONCURRENT_${actionName}`]) 
            : maxConcurrent;

        const requestSlot = async () => {
            if (!process.send) {
                // Fallback for local execution
                const current = localActiveTasks.get(actionName) || 0;
                if (current >= maxLimit) return false;
                localActiveTasks.set(actionName, current + 1);
                return true;
            }

            return new Promise(resolve => {
                const reqId = crypto.randomUUID();
                const handler = (msg) => {
                    if (msg.reqId === reqId) {
                        process.removeListener('message', handler);
                        if (msg.cmd === grantedCmd) resolve(true);
                        else if (msg.cmd === deniedCmd) resolve(false);
                    }
                };
                process.on('message', handler);
                process.send({ cmd: requestCmd, reqId, maxLimit });
            });
        };

        const slotGranted = await requestSlot();

        if (!slotGranted) {
            logger.warn(`[LOAD SHEDDING] ${actionName} limit reached (${maxLimit}). Request rejected.`);
            return res.status(429).json({ error: rejectMessage });
        }

        // We got the slot! Now we must ensure it is released exactly when the response finishes
        const releaseSlot = () => {
            if (!process.send) {
                const current = localActiveTasks.get(actionName) || 0;
                localActiveTasks.set(actionName, Math.max(0, current - 1));
            } else {
                process.send({ cmd: releaseCmd });
            }
        };

        // Attach listener to response finish or close (client abort)
        res.on('finish', releaseSlot);
        res.on('close', () => {
            if (!res.writableFinished) releaseSlot();
        });

        next();
    };
};

module.exports = {
    withConcurrencyLimit
};
