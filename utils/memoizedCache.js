const logger = require('./logger');

// In-memory Promise cache to solve the Thundering Herd (Cache Stampede) problem
const promiseCache = new Map();

/**
 * Executes a heavy function and caches its result.
 * If 100 requests ask for the same key simultaneously, only 1 request actually
 * triggers the heavy function. The other 99 instantly wait for the first one's Promise.
 * 
 * @param {string} key - Unique cache key
 * @param {number} ttlMs - Time to live in milliseconds
 * @param {Function} heavyFunction - The async function to execute if cache miss
 * @returns {Promise<any>}
 */
async function getMemoized(key, ttlMs, heavyFunction) {
    const now = Date.now();

    // 1. Check if we already have a Promise or Result in flight/cache
    if (promiseCache.has(key)) {
        const cached = promiseCache.get(key);
        if (cached.expires > now) {
            logger.info(`[CACHE] Thundering Herd blocked! Serving Promise/Data for key: ${key}`);
            return cached.promise;
        } else {
            // Expired, remove it
            promiseCache.delete(key);
        }
    }

    // 2. Cache Miss! We must execute the heavy function.
    logger.info(`[CACHE] Miss for key: ${key}. Executing heavy function...`);
    
    // We instantly store the PROMISE in the cache, BEFORE it resolves.
    // This is the magic that protects against the Thundering Herd.
    const promise = heavyFunction().catch(err => {
        // If it fails, delete the promise so the next request can try again
        promiseCache.delete(key);
        throw err;
    });

    promiseCache.set(key, {
        promise,
        expires: now + ttlMs
    });

    return promise;
}

/**
 * Manually invalidate a cache key
 */
function invalidateKey(key) {
    promiseCache.delete(key);
    logger.info(`[CACHE] Invalidated key: ${key}`);
}

module.exports = {
    getMemoized,
    invalidateKey
};
