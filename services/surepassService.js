const axios = require('axios');
const logger = require('../utils/logger');
const { BadRequestError } = require('../GlobalExceptionHandler/exception');
const { createCircuitBreaker } = require('../utils/circuitBreaker');

const SUREPASS_BASE_URL = process.env.SUREPASS_BASE_URL || 'https://sandbox.surepass.app';
const SUREPASS_TOKEN = process.env.SUREPASS_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmcmVzaCI6ZmFsc2UsImlhdCI6MTc3NDQxNjUyNSwianRpIjoiNjU1ZGMwMTgtOWZlOC00MTdkLTgyZjItZDA1NDhmYjgyODIxIiwidHlwZSI6ImFjY2VzcyIsImlkZW50aXR5IjoiZGV2LmJ1bWN1bWZpbnNlcnZlQHN1cmVwYXNzLmlvIiwibmJmIjoxNzc0NDE2NTI1LCJleHAiOjE3NzcwMDg1MjUsImVtYWlsIjoiYnVtY3VtZmluc2VydmVAc3VyZXBhc3MuaW8iLCJ0ZW5hbnRfaWQiOiJtYWluIiwidXNlcl9jbGFpbXMiOnsic2NvcGVzIjpbInVzZXIiXX19.-KnhmxDe-pBm8vWSvFJ764VspfwM2kHu-Zf0z4sw8fI';

class SurepassService {
  constructor() {
    this.client = axios.create({
      baseURL: SUREPASS_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUREPASS_TOKEN}`
      }
    });

    this.panBreaker = createCircuitBreaker(
      (data) => this.client.post('/api/v1/pan/pan-comprehensive', data),
      'Surepass PAN API'
    );

    this.aadhaarBreaker = createCircuitBreaker(
      (data) => this.client.post('/api/v1/aadhaar-validation/aadhaar-validation', data),
      'Surepass Aadhaar API'
    );
  }

  /**
   * Verify PAN via Surepass PAN Comprehensive API
   * @param {string} panNumber
   * @returns {Promise<Object>} user details from PAN
   */
  async verifyPAN(panNumber) {
    // Inject MOCK response for testing frontend autofill
    if (panNumber.toUpperCase() === 'TEST00000X') {
      return {
        client_id: "mock_client_demo123",
        pan_number: "TEST00000X",
        full_name: "PRIYANSHU ROUTH",
        gender: "MALE",
        dob: "2000-05-15",
        status: "valid"
      };
    }

    try {
      const response = await this.panBreaker.fire({
        id_number: panNumber
      });

      if (!response.data.success) {
        throw new BadRequestError('oops Invalid Pan number');
      }

      return response.data.data; // Surepass usually wraps standard data in { data: { ... } }
    } catch (error) {
      if (error.response && error.response.data) {
        logger.error(`Surepass PAN API Error: ${JSON.stringify(error.response.data)}`);
        throw new BadRequestError('oops Invalid Pan number');
      }
      console.error("RAW_NATIVE_ERROR:", error);
      logger.error('Surepass PAN execution error:', error.message);
      throw new BadRequestError('oops Invalid Pan number');
    }
  }

  /**
   * Verify Aadhaar via Surepass Aadhaar Validation API
   * @param {string} aadhaarNumber
   * @returns {Promise<Object>} confirmation details 
   */
  async verifyAadhaar(aadhaarNumber) {
    if (aadhaarNumber === '123456789012') {
      return {
        client_id: "mock_client_demo123",
        aadhaar_number: "123456789012",
        status: "valid"
      };
    }

    try {
      const response = await this.aadhaarBreaker.fire({
        id_number: aadhaarNumber
      });

      if (!response.data.success) {
        throw new BadRequestError('oops invalid adhar number');
      }

      return response.data.data;
    } catch (error) {
      // If there is an HTTP response body, it means Surepass was reachable and
      // explicitly rejected the Aadhaar number (e.g. number not found in DB)
      if (error.response && error.response.data) {
        const status = error.response.status;
        // 401/403 = auth failure (expired/invalid token) → treat as service unavailable
        if (status === 401 || status === 403) {
          logger.error(`Surepass Aadhaar auth failure (status ${status}): token may be expired. Treating as service unavailable.`);
          const unavailableErr = new Error('SUREPASS_UNAVAILABLE');
          unavailableErr.isSurepassUnavailable = true;
          throw unavailableErr;
        }
        logger.error(`Surepass Aadhaar API Error: ${JSON.stringify(error.response.data)}`);
        throw new BadRequestError('oops invalid adhar number');
      }
      // No HTTP response = network error, timeout, circuit breaker open, etc.
      logger.error('Surepass Aadhaar execution error:', error.message);
      const unavailableErr = new Error('SUREPASS_UNAVAILABLE');
      unavailableErr.isSurepassUnavailable = true;
      throw unavailableErr;
    }
  }
}

module.exports = new SurepassService();
