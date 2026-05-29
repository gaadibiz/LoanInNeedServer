const NodeCache = require('node-cache');
const logger = require('../utils/logger');

// Cache keys for 24 hours (86400 seconds) to prevent duplicate submissions
const idempotencyCache = new NodeCache({ stdTTL: 86400, checkperiod: 120 });

/**
 * Idempotency Middleware
 * Intercepts requests containing an `Idempotency-Key` or `X-Idempotency-Key` header.
 * If a successful response was already sent for that key in the past 24 hours,
 * it bypasses the route handler and immediately returns the cached response.
 * This prevents accidental duplicate operations (e.g. creating two loans).
 */
const idempotencyMiddleware = (req, res, next) => {
  // Only apply to state-changing requests
  if (req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'PATCH') {
    return next();
  }

  const idempotencyKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];
  
  if (!idempotencyKey) {
    // If no key provided, just continue normally
    return next();
  }

  const cacheKey = `idempotency_${idempotencyKey}`;
  const cachedResponse = idempotencyCache.get(cacheKey);

  if (cachedResponse) {
    logger.info(`[IDEMPOTENCY] Replaying cached response for key: ${idempotencyKey}`);
    return res.status(cachedResponse.statusCode).json(cachedResponse.body);
  }

  // Intercept the response's json method to cache the output before sending it to the client
  const originalJson = res.json;
  
  res.json = function (body) {
    // Cache the response if it was successful (2xx) or a client error (4xx).
    // We intentionally do not cache 5xx server errors so the client can retry and hit the actual logic.
    if (res.statusCode >= 200 && res.statusCode < 500) {
      idempotencyCache.set(cacheKey, {
        statusCode: res.statusCode,
        body: body
      });
      logger.info(`[IDEMPOTENCY] Cached new response for key: ${idempotencyKey}`);
    }
    
    // Call the original res.json method
    return originalJson.call(this, body);
  };

  next();
};

module.exports = idempotencyMiddleware;
