const axios = require('axios');
const logger = require('../utils/logger');
const { BadRequestError } = require('../GlobalExceptionHandler/exception');

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
      const response = await this.client.post('/api/v1/pan/pan-comprehensive', {
        id_number: panNumber
      });

      if (!response.data.success) {
        throw new BadRequestError(response.data.message || 'PAN Verification failed');
      }

      return response.data.data; // Surepass usually wraps standard data in { data: { ... } }
    } catch (error) {
      if (error.response && error.response.data) {
        logger.error(`Surepass PAN API Error: ${JSON.stringify(error.response.data)}`);
        throw new BadRequestError(error.response.data.message || 'Invalid PAN');
      }
      console.error("RAW_NATIVE_ERROR:", error);
      logger.error('Surepass PAN execution error:', error.message);
      throw new BadRequestError('Failed to verify PAN with external provider');
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
        aadhaar_number: "XXXXXXXX9012",
        status: "valid"
      };
    }

    try {
      const response = await this.client.post('/api/v1/aadhaar-validation/aadhaar-validation', {
        id_number: aadhaarNumber
      });

      if (!response.data.success) {
        throw new BadRequestError(response.data.message || 'Aadhaar Verification failed');
      }

      return response.data.data;
    } catch (error) {
      if (error.response && error.response.data) {
        logger.error(`Surepass Aadhaar API Error: ${JSON.stringify(error.response.data)}`);
        throw new BadRequestError(error.response.data.message || 'Invalid Aadhaar Number');
      }
      logger.error('Surepass Aadhaar execution error:', error.message);
      throw new BadRequestError('Failed to verify Aadhaar with external provider');
    }
  }
}

module.exports = new SurepassService();
