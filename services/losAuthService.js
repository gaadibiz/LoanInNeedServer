const axios = require('axios');
const logger = require('../utils/logger');

// LOS Authentication configuration
const LOS_AUTH_URL = process.env.LOS_AUTH_URL || 'http://59.95.101.93:7021/api/auth/login';
const LOS_USERNAME = process.env.LOS_USERNAME || 'indradeep';
const LOS_PASSWORD = process.env.LOS_PASSWORD || 'admin123';

const { appCache } = require('../utils/cache');

/**
 * Decode JWT expiry from token string (no external lib needed)
 */
const getJwtExpiry = (token) => {
    try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8'));
        if (payload.exp) {
            return new Date(payload.exp * 1000); // exp is in seconds
        }
    } catch (_) { /* ignore decode errors */ }
    return null;
};

/**
 * Fetches a valid Bearer token for LOS
 * Uses caching to prevent spamming the Auth API
 */
const getLosToken = async () => {
    try {
        const now = new Date();

        // 1. Return cached token if still valid
        const cachedToken = appCache.get('los_auth_token');
        if (cachedToken) {
            return cachedToken;
        }

        logger.info('[LOS AUTH] Requesting new Bearer token from LOS...');

        // 2. Fetch new token
        // Replace this with actual authentication logic. Often it's a POST with username/password, or client_id/client_secret
        // Below is a generic implementation.
        const response = await axios.post(LOS_AUTH_URL, {
            UserName: LOS_USERNAME,
            Password: LOS_PASSWORD,
            username: LOS_USERNAME,
            password: LOS_PASSWORD
        }, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });

        // LOS returns { isSuccess: true, Token: "...", UserName: "...", Usertype: 3 }
        // Check Token (capital T) first since that's what LOS v1 API actually returns
        const tokenValue = response.data?.Token
            || response.data?.token
            || response.data?.access_token
            || response.data?.AccessToken
            || response.data?.jwtToken;

        if (tokenValue) {
            // Use actual JWT expiry if available, otherwise default 1 hour
            const jwtExpiry = getJwtExpiry(tokenValue);
            const tokenExpiry = jwtExpiry || new Date(now.getTime() + 60 * 60 * 1000);
            
            // Calculate TTL in seconds, with a 5-minute safety buffer
            const ttlSeconds = Math.max(1, Math.floor((tokenExpiry.getTime() - now.getTime()) / 1000) - 300);
            appCache.set('los_auth_token', tokenValue, ttlSeconds);
            
            logger.info(`[LOS AUTH] Successfully retrieved new token. Expires: ${tokenExpiry.toISOString()} (TTL: ${ttlSeconds}s)`);
            return tokenValue;
        } else {
            logger.error('[LOS AUTH] Token response received but no token field found:', JSON.stringify(response.data));
            throw new Error(`Invalid token response from LOS. Response: ${JSON.stringify(response.data)}`);
        }

    } catch (error) {
        logger.error(`[LOS AUTH] Failed to retrieve token: ${error.message}`, error.response ? error.response.data : {});
        if (error.response && error.response.data) {
            throw new Error(`LOS authentication failed with 400: ${JSON.stringify(error.response.data)}`);
        }
        throw error;
    }
};

/**
 * Force clear the token (e.g. if we get a 401 Unauthorized)
 */
const invalidateToken = () => {
    appCache.del('los_auth_token');
    logger.info('[LOS AUTH] Token cache invalidated');
};

module.exports = {
    getLosToken,
    invalidateToken
};
