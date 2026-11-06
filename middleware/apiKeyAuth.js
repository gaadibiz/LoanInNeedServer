const { UnauthorizedError } = require('../GlobalExceptionHandler/exception');
const logger = require('../utils/logger');

const verifyApiKey = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Key ')) {
        logger.warn('Missing or invalid Authorization header for API Key route');
        throw new UnauthorizedError('Unauthorized: Missing or invalid API Key format. Expected "Key <your_api_key>"');
    }

    const apiKey = authHeader.split(' ')[1];
    const expectedKey = process.env.EXPORT_API_KEY;

    if (!expectedKey) {
        logger.error('EXPORT_API_KEY is not configured in environment variables');
        throw new Error('Server misconfiguration: API Key not set');
    }

    if (apiKey !== expectedKey) {
        logger.warn('Invalid API Key provided');
        throw new UnauthorizedError('Unauthorized: Invalid API Key');
    }

    next();
};

/**
 * Flexible authentication middleware for external Webhooks (e.g. Finnaux).
 * Supports:
 * - Header: x-api-key: <key>
 * - Header: Authorization: Key <key>
 * - Header: Authorization: Bearer <key>
 * - Header: Authorization: <key>
 */
const verifyWebhookAuth = (req, res, next) => {
    const headerKey = req.headers['x-api-key'] || req.headers['x-webhook-key'];
    const authHeader = req.headers.authorization;
    let token = headerKey || authHeader || null;

    if (token) {
        token = String(token).trim();
        // Strip 'Key ' or 'Bearer ' prefix if passed in x-api-key or Authorization
        if (/^(key|bearer)\s+/i.test(token)) {
            token = token.replace(/^(key|bearer)\s+/i, '').trim();
        }
    }

    const expectedKeys = [
        process.env.FINNAUX_WEBHOOK_KEY,
        process.env.EXPORT_API_KEY,
        process.env.FINNAUX_API_KEY
    ].filter(Boolean);

    if (expectedKeys.length === 0) {
        logger.error('[WEBHOOK AUTH] No API/Webhook key configured in environment variables');
        throw new Error('Server misconfiguration: Webhook API Key not set');
    }

    if (!token || !expectedKeys.includes(token)) {
        logger.warn(`[WEBHOOK AUTH] Unauthorized webhook call attempt from IP ${req.ip || req.connection?.remoteAddress || 'UNKNOWN'}`);
        throw new UnauthorizedError('Unauthorized: Missing or invalid API Key (expected x-api-key or Authorization header)');
    }

    next();
};

module.exports = { verifyApiKey, verifyWebhookAuth };

