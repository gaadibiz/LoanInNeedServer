const axios = require('axios');
const logger = require('../utils/logger');

// LOS Authentication configuration
// Ideally these should be in .env, but hardcoding for immediate integration requirement if not provided.
const LOS_AUTH_URL = process.env.LOS_AUTH_URL || 'http://192.168.0.16:7021/api/Auth/Token'; // Adjust if auth endpoint is different
const LOS_USERNAME = process.env.LOS_USERNAME || 'admin';
const LOS_PASSWORD = process.env.LOS_PASSWORD || 'password';

// In-memory token cache
let cachedToken = null;
let tokenExpiry = null;

/**
 * Fetches a valid Bearer token for LOS
 * Uses caching to prevent spamming the Auth API
 */
const getLosToken = async () => {
    try {
        const now = new Date();

        // 1. Return cached token if still valid (buffer of 5 mins)
        if (cachedToken && tokenExpiry && (tokenExpiry.getTime() - now.getTime()) > 5 * 60 * 1000) {
            return cachedToken;
        }

        logger.info('[LOS AUTH] Requesting new Bearer token from LOS...');

        // 2. Fetch new token
        // Replace this with actual authentication logic. Often it's a POST with username/password, or client_id/client_secret
        // Below is a generic implementation.
        const response = await axios.post(LOS_AUTH_URL, {
            username: LOS_USERNAME,
            password: LOS_PASSWORD
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.data && response.data.token) {
            cachedToken = response.data.token;
            // Token validity is 1 hour
            // Set expiry to exactly 1 hour from now
            tokenExpiry = new Date(now.getTime() + 60 * 60 * 1000);

            logger.info('[LOS AUTH] Successfully retrieved new token');
            return cachedToken;
        } else {
            throw new Error("Invalid token response from LOS");
        }

    } catch (error) {
        logger.error(`[LOS AUTH] Failed to retrieve token: ${error.message}`);
        throw error;
    }
};

/**
 * Force clear the token (e.g. if we get a 401 Unauthorized)
 */
const invalidateToken = () => {
    cachedToken = null;
    tokenExpiry = null;
    logger.info('[LOS AUTH] Token cache invalidated');
};

module.exports = {
    getLosToken,
    invalidateToken
};
