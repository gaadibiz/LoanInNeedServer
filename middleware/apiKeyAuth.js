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

module.exports = { verifyApiKey };
