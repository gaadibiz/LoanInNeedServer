const CircuitBreaker = require('opossum');
const logger = require('./logger');

/**
 * Wraps an async function with an Opossum Circuit Breaker
 * 
 * @param {Function} asyncFunction - The function to execute
 * @param {string} breakerName - A recognizable name for logging (e.g., 'Surepass API')
 * @param {object} options - Custom Opossum options
 */
const createCircuitBreaker = (asyncFunction, breakerName, options = {}) => {
  const defaultOptions = {
    timeout: 30000, // If function takes longer than 30s, trigger a failure
    errorThresholdPercentage: 50, // When 50% of requests fail, open the circuit
    resetTimeout: 30000, // After 30s, try one request to see if the service is back
    ...options
  };

  const breaker = new CircuitBreaker(asyncFunction, defaultOptions);

  breaker.on('open', () => {
    logger.error(`[CIRCUIT BREAKER] 🔴 ${breakerName} circuit OPENED. Failing fast to protect system.`);
  });

  breaker.on('halfOpen', () => {
    logger.warn(`[CIRCUIT BREAKER] 🟡 ${breakerName} circuit HALF-OPEN. Testing service health...`);
  });

  breaker.on('close', () => {
    logger.info(`[CIRCUIT BREAKER] 🟢 ${breakerName} circuit CLOSED. Service fully recovered.`);
  });

  breaker.on('fallback', (result, error) => {
    // Only log if we didn't explicitly throw an error inside the fallback
    if (error && error.message) {
      logger.warn(`[CIRCUIT BREAKER] ⚠️ ${breakerName} request failed. Error: ${error.message}`);
    }
  });

  return breaker;
};

module.exports = {
  createCircuitBreaker
};
