const NodeCache = require('node-cache');
const logger = require('./logger');

/**
 * General application cache for lightweight data (e.g., API tokens).
 * Default TTL: 1 hour (3600 seconds)
 * Check period: 10 minutes
 */
const appCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });

module.exports = {
    appCache
};
