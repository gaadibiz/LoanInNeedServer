const axios = require('axios');
const logger = require('../utils/logger');
const { getLosToken, invalidateToken } = require('./losAuthService');

const LOS_SAVE_URL = process.env.LOS_SAVE_URL || 'http://192.168.0.16:7021/api/NewApplicationAPI/SaveNewApplication';
const MAX_RETRIES = 3;

/**
 * Make the HTTP POST to LOS `SaveNewApplication` API
 */
const createLosApplication = async (payload) => {
    let lastError = null;

    // We allow internal retries specifically for 401 Unauthorized (Token Expiry)
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            // 1. Get Token
            const token = await getLosToken();

            logger.info('[LOS API] Sending application payload to LOS...', { items: Object.keys(payload) });

            // 2. Perform API Call
            const response = await axios.post(LOS_SAVE_URL, payload, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000 // 30 second timeout as LOS heavily processes
            });

            logger.info(`[LOS API] Success! Response Data: ${JSON.stringify(response.data)}`);

            // Expected Response format handling
            // Assuming LOS returns { ApplicationID: '1234', CaseNumber: 'C-567', Status: 'Success' }
            return {
                success: true,
                applicationId: response.data.ApplicationID || null,
                caseNumber: response.data.CaseNumber || null,
                kycId: response.data.KyCID || null,
                rawData: response.data
            };

        } catch (error) {
            lastError = error;

            // If it's a 401 Unauthorized, maybe token expired mid-way, invalidate and retry once
            if (error.response && error.response.status === 401 && attempt === 1) {
                logger.warn('[LOS API] 401 Unauthorized. Invalidating token and retrying...');
                invalidateToken();
                continue;
            }

            // Other errors (4xx, 5xx, network timeouts) break out immediately to the worker queue retry system
            const status = error.response ? error.response.status : 'Network/Timeout';
            const data = error.response ? JSON.stringify(error.response.data) : error.message;
            logger.error(`[LOS API] Application submission failed. Status: ${status}, Response: ${data}`);

            throw new Error(`LOS request failed: ${status} - ${data}`);
        }
    }

    throw lastError; // Should technically never reach here without throwing inside the loop, but fallback
};

module.exports = {
    createLosApplication
};
