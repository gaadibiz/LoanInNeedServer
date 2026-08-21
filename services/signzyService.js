const axios = require('axios');
const logger = require('../utils/logger');
const { BadRequestError } = require('../GlobalExceptionHandler/exception');
const { createCircuitBreaker } = require('../utils/circuitBreaker');
const { SERVICE_URLS } = require('../utils/microserviceUrl');

const SIGNZY_BASE_URL = process.env.SIGNZY_PREFIX || 'https://api-preproduction.signzy.app';
const SIGNZY_TOKEN = process.env.SIGNZY_TOKEN || 'UJULyodf25LFtNZGyoliwUvgvxWNYki1';

class SignZyService {
  constructor() {
    this.client = axios.create({
      baseURL: SIGNZY_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': SIGNZY_TOKEN
      }
    });

    this.digilockerRequestUrlBreaker = createCircuitBreaker(
      (data) => this.client.post(SERVICE_URLS.requestDigilocker, data),
      'SignZy Digilocker Request URL'
    );

    this.digilockerGetEAadhaarBreaker = createCircuitBreaker(
      (data) => this.client.post(SERVICE_URLS.getEAadhaar, data),
      'SignZy Digilocker Get e-Aadhaar'
    );

    this.phonePrefillBreaker = createCircuitBreaker(
      (data) => this.client.post(SERVICE_URLS.phonePrefill, data),
      'SignZy Phone Prefill'
    );
  }

  /**
   * Ask Signzy to generate a Digilocker consent URL for a user
   * @param {number} userId
   * @returns {Promise<{ url: string, requestId: string }>}
   */
  async createDigilockerUrl(userId) {
    try {
      const response = await this.digilockerRequestUrlBreaker.fire({
        successRedirectUrl: `${process.env.FRONTEND_URL}/signup`,
        failureRedirectUrl: `${process.env.FRONTEND_URL}/signup`,
        docType: ['ADHAR'],
        purpose: 'kyc',
        internalId: String(userId),
      });

      const result = response?.data?.result;

      if (!result?.url || !result?.requestId) {
        throw new BadRequestError('Digilocker did not return a valid URL');
      }

      return { url: result.url, requestId: result.requestId };
    } catch (error) {
      if (error.response?.data) {
        logger.error(`SignZy Digilocker API Error: ${JSON.stringify(error.response.data)}`);
      } else {
        logger.error(`SignZy Digilocker execution error: ${error.message}`);
      }
      throw new BadRequestError('Unable to generate Digilocker URL at this time');
    }
  }

  /**
   * Fetch the e-Aadhaar details Signzy retrieved from Digilocker for a completed requestId
   * @param {string} requestId
   * @returns {Promise<Object>} flattened e-Aadhaar fields + rawResponse for audit
   */
  async getEAadhaarDetails(requestId) {
    try {
      const response = await this.digilockerGetEAadhaarBreaker.fire({
        requestId,
        extraDigitalCertificateParams: false,
        getBase64Files: false,
        getEAadhaarPdf: false,
        getEAadhaarJpeg: true,
      });

      const result = response?.data?.result;

      if (!result?.uid) {
        throw new BadRequestError('Signzy did not return e-Aadhaar details');
      }

      return {
        uid: result.uid,
        name: result.name,
        dob: result.dob,
        gender: result.gender,
        address: result.address,
        photo: result.photo,
        splitAddress: result.splitAddress,
        aadhaarJpeg: response.data.aadhaarJpeg,
        rawResponse: result,
      };
    } catch (error) {
      if (error.response?.data) {
        logger.error(`SignZy Get e-Aadhaar API Error: ${JSON.stringify(error.response.data)}`);
      } else {
        logger.error(`SignZy Get e-Aadhaar execution error: ${error.message}`);
      }
      throw new BadRequestError('Unable to fetch e-Aadhaar details at this time');
    }
  }

  /**
   * Fetch prefill details (addresses, alternate contacts, identity docs, income, etc.)
   * for a user from Signzy's Phone-to-Prefill API.
   * @param {{ phoneNumber: string, firstName: string, lastName?: string, pan?: string }} params
   * @returns {Promise<Object>} the raw `response` object from Signzy
   */
  async getPhonePrefillDetails({ mobileNumber, fullName,consent }) {
    try {
      const response = await this.phonePrefillBreaker.fire({
        mobileNumber,
        fullName,
        consent,
      });

      const result = response?.data?.response;

      if (!result) {
        throw new BadRequestError('Signzy did not return phone prefill details');
      }

      return result;
    } catch (error) {
      if (error.response?.data) {
        logger.error(`SignZy Phone Prefill API Error: ${JSON.stringify(error.response.data)}`);
      } else {
        logger.error(`SignZy Phone Prefill execution error: ${error.message}`);
      }
      throw new BadRequestError('Unable to fetch phone prefill details at this time');
    }
  }
}

module.exports = new SignZyService();
