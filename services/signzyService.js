const axios = require('axios');
const logger = require('../utils/logger');
const { BadRequestError } = require('../GlobalExceptionHandler/exception');
const { createCircuitBreaker } = require('../utils/circuitBreaker');
const { SERVICE_URLS } = require('../utils/microserviceUrl');
require('dotenv').config()

const SIGNZY_TOKEN = process.env.SIGNZY_TOKEN || 'J6lbpOPjZSN3p0beAFp0ftcrCsuEPsVO' || 'UJULyodf25LFtNZGyoliwUvgvxWNYki1';
const DIGILOCKER_CALLBACK_URL = 
process.env.SERVER_URL + '/api/auth/aadhaar/save-verified-adhaar-details' 
  //'https://geographic-participate-impression-dat.trycloudflare.com/api/auth/aadhaar/save-verified-adhaar-details';

class SignZyService {
  constructor() {
    this.client = axios.create({
      baseURL: '',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': SIGNZY_TOKEN
      }
    });

    this.digilockerRequestUrlBreaker = createCircuitBreaker(
      (data) => {
    
        return this.client.post(SERVICE_URLS.requestDigilocker, { ...data, signup: true, })
      },
      'SignZy Digilocker Request URL'
    );

    this.digilockerGetEAadhaarBreaker = createCircuitBreaker(
      (data) => {
        return this.client.post(SERVICE_URLS.getEAadhaar, data)
      },
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
    const consentValidTill = Math.floor(Date.now() / 1000) + 600;

    try {
      const response = await this.digilockerRequestUrlBreaker.fire(
        {
          "signup": true,
          "redirectUrl": "https://www.signzy.com/",
          "redirectTime": "1",
          "callbackUrl": DIGILOCKER_CALLBACK_URL,
          "successRedirectUrl": 'https://www.signzy.com/',
          "successRedirectTime": "5",
          "failureRedirectUrl": "https://www.signzy.com/",
          "failureRedirectTime": "5",
          "logoVisible": "true",
          "logo": "https://enr-biolerplate-7may26.s3.ap-south-1.amazonaws.com/company_outlet_logo/navneen_2026-08-22_04-25-56.jpeg",
          "supportEmailVisible": "true",
          "supportEmail": "support@signzy.com",
          "docType": [
            "PANCR",
            "ADHAR"
          ],
          "pinlessAuthentication": true,
          "consentValidTill": Math.floor(Date.now() / 1000) + 60000,
          "shortenUrl": true,
          "purpose": "kyc",
          "getScope": true,
          "showLoaderState": true,
          "internalId": `${userId}`,
          "companyName": "Signzy",
          "favIcon": "https://enr-biolerplate-7may26.s3.ap-south-1.amazonaws.com/company_outlet_logo/favicon_2026-09-03_06-30-06.png",
          "getBase64Files": false,
          "getEAadhaarPdf": true,
          "getEAadhaarJpeg": true
        }
      );

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
  async getEAadhaarDetails(requestId, aadhaarNumber) {
    try {
      const response = await this.digilockerGetEAadhaarBreaker.fire({
        requestId,
        extraDigitalCertificateParams: true,
        getBase64Files: true,
        getEAadhaarPdf: true,
        getEAadhaarJpeg: true,
      });

      const result = response?.data?.result;

      if (!result?.uid) {
        throw new BadRequestError('Signzy did not return e-Aadhaar details');
      }

      return {
        uid: aadhaarNumber,
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
  async getPhonePrefillDetails({ mobileNumber, fullName, consent }) {
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
