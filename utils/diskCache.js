const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('./logger');

// Store cache in a hidden .cache directory in the Backend root
const CACHE_DIR = path.join(__dirname, '..', '.cache');
const TTL_MS = 60 * 60 * 1000; // 1 hour time-to-live

// Ensure cache directory exists on startup
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

/**
 * Generate a safe, flat filename from an S3 key to avoid directory traversal or invalid characters.
 */
const getCacheFilePath = (key) => {
    const hash = crypto.createHash('sha256').update(key).digest('hex');
    return path.join(CACHE_DIR, `${hash}.b64`);
};

/**
 * Clean up old files from the cache directory to prevent disk space exhaustion.
 */
const cleanupOldCache = () => {
    try {
        const now = Date.now();
        const files = fs.readdirSync(CACHE_DIR);
        let deletedCount = 0;
        
        for (const file of files) {
            const filePath = path.join(CACHE_DIR, file);
            const stats = fs.statSync(filePath);
            if (now - stats.mtimeMs > TTL_MS) {
                fs.unlinkSync(filePath);
                deletedCount++;
            }
        }
        
        if (deletedCount > 0) {
            logger.info(`[DISK CACHE] Cleaned up ${deletedCount} expired cached documents.`);
        }
    } catch (err) {
        logger.error(`[DISK CACHE] Cleanup error: ${err.message}`);
    }
};

/**
 * Retrieve a cached Base64 string from the local SSD.
 * @param {string} key - The S3 Key
 * @returns {string|null} - Base64 string or null if not found/expired
 */
const getFromDiskCache = (key) => {
    try {
        const filePath = getCacheFilePath(key);
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            if (Date.now() - stats.mtimeMs < TTL_MS) {
                return fs.readFileSync(filePath, 'utf8');
            } else {
                // Delete if expired
                fs.unlinkSync(filePath);
                return null;
            }
        }
    } catch (err) {
        logger.warn(`[DISK CACHE] Read error for key ${key}: ${err.message}`);
    }
    return null;
};

/**
 * Save a large Base64 string to the local SSD cache.
 * @param {string} key - The S3 Key
 * @param {string} value - The Base64 string
 */
const setToDiskCache = (key, value) => {
    try {
        const filePath = getCacheFilePath(key);
        fs.writeFileSync(filePath, value, 'utf8');
        
        // Randomly trigger cleanup on roughly 10% of writes to prevent a dedicated cron job
        if (Math.random() < 0.1) {
            setTimeout(cleanupOldCache, 0);
        }
    } catch (err) {
        logger.error(`[DISK CACHE] Write error for key ${key}: ${err.message}`);
    }
};

module.exports = {
    getFromDiskCache,
    setToDiskCache,
    cleanupOldCache
};
