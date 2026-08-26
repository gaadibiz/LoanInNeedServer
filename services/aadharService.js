const prisma = require('../utils/prismaClient');
const AadhaarModel = require('../models/aadhaarModel');
const UserModel = require('../models/userModel');
const signzyService = require('./signzyService');
const logger = require('../utils/logger');
const { BadRequestError, NotFoundError } = require('../GlobalExceptionHandler/exception');

class AadhaarService {

  /**
   * Mask Aadhaar number - shows only last 4 digits
   * Example: 1234 5678 9012 -> ********9012
   */
  maskAadhaar(aadhaar) {
    return aadhaar.replace(/.(?=....)/g, "*");
  }

  /**
   * Validate Aadhaar number format
   * Format: Must be 12 digits starting with 2-9
   */
  validateAadhaarFormat(aadhaar) {
    const regex = /^[2-9]{1}[0-9]{11}$/;
    return regex.test(aadhaar);
  }

  /**
   * Submit Aadhaar number - creates or updates record
   */
  async submitAadhaar(userId, number) {
    if (!number) throw new BadRequestError("Aadhaar number is required");

    // Remove spaces if any
    const cleanedNumber = number.toString().replace(/\s/g, '');

    if (!this.validateAadhaarFormat(cleanedNumber)) {
      throw new BadRequestError("Invalid Aadhaar number format. Must be 12 digits starting with 2-9");
    }

    // Do not mask the Aadhaar before storing as per new requirement
    const finalAadhaar = cleanedNumber;

    return prisma.$transaction(async (tx) => {
      const existing = await AadhaarModel.findByUserId(userId, tx);

      if (existing) {
        // Update existing record — try to update with real number
        try {
          return await AadhaarModel.updateAadhaarRecord(userId, {
            aadhaarNumber: finalAadhaar,
            verified: false,
            verifiedAt: null
          }, tx);
        } catch (err) {
          if (err.code === 'P2002') {
            throw new BadRequestError("This Aadhaar number is already registered with another account.");
          }
          throw err;
        }
      }

      // Create new record
      try {
        return await AadhaarModel.createAadhaarRecord(userId, finalAadhaar, tx);
      } catch (err) {
        if (err.code === 'P2002') {
          throw new BadRequestError("This Aadhaar number is already registered with another account.");
        }
        throw err;
      }
    });
  }

  /**
   * Get Aadhaar verification status
   */
  async getAadhaarStatus(userId) {
    const record = await AadhaarModel.findByUserId(userId);
    if (!record) throw new NotFoundError("Aadhaar not submitted");

    return {
      aadhaarNumber: record.aadhaarNumber, // already masked in DB
      verified: record.verified,
      verifiedAt: record.verifiedAt,
      submittedAt: record.createdAt || null
    };
  }

  /**
   * Verify Aadhaar - typically called by admin/automated system
   */
  async verifyAadhaar(userId) {
    return prisma.$transaction(async (tx) => {
      const existing = await AadhaarModel.findByUserId(userId, tx);
      if (!existing) throw new NotFoundError("Aadhaar record not found");

      const updated = await AadhaarModel.verifyAadhaar(userId, tx);
      return { message: "Aadhaar verified successfully", updated };
    });
  }

  /**
   * Get full Aadhaar details (admin only)
   */
  async getAadhaarDetails(userId) {
    const data = await AadhaarModel.findByUserId(userId);
    if (!data) throw new NotFoundError("Aadhaar record not found");
    return data;
  }

  /**
   * Generate a Digilocker consent URL via Signzy and record the requestId
   * against the user so the frontend can later resolve it after redirect.
   */
  async requestDigilockerUrl(userId, { mock = false } = {}) {
    let digilockerDetails;

    if (mock) {
      logger.info(`[DIGILOCKER] Mock URL requested by user ${userId}`);
      digilockerDetails = {
        url: 'https://api.digitallocker.gov.in/public/oauth2/1/authorize?client_id=MOCK&mock=true',
        requestId: `MOCK-${userId}-${Date.now()}`,
      };
    } else {
      digilockerDetails = await signzyService.createDigilockerUrl(userId);
    }

    await UserModel.updateUser(userId, {
      digilockerRequestId: digilockerDetails.requestId,
      digilockerStatus: 'URL_CREATED',
    });

    logger.info(`[DIGILOCKER] URL created for user ${userId}, requestId=${digilockerDetails.requestId}`);

    return digilockerDetails;
  }

  /**
   * Called once the user is back from the Digilocker consent flow: look up
   * the requestId already stored on this user, fetch the e-Aadhaar via
   * Signzy, and persist it.
   */
  async handleDigilockerCallback(userId, status) {
    let requestId = (await UserModel.findUserById(userId)).digilockerRequestId;
    if (!requestId) throw new BadRequestError('requestId is required');

    const user = await UserModel.findUserById(userId);
    if (!user) throw new NotFoundError(`No user found for Digilocker requestId ${requestId}`);

    if (status !== 'success') {
      await UserModel.updateUser(user.id, { digilockerStatus: 'CONSENT_FAILED' });
      logger.warn(`[DIGILOCKER] Consent not completed for user ${user.id}, requestId=${requestId}`);
      return { userId: user.id, saved: false };
    }

    let eAadhaar;
    try {
      eAadhaar = await signzyService.getEAadhaarDetails(requestId);
    } catch (err) {
      await UserModel.updateUser(user.id, { digilockerStatus: 'FETCH_FAILED' });
      logger.error(`[DIGILOCKER] Get e-Aadhaar failed for user ${user.id}, requestId=${requestId}: ${err.message}`);
      throw err;
    }

    await prisma.$transaction(async (tx) => {
      await AadhaarModel.saveEAadhaarDetails(user.id, eAadhaar, tx);
      await UserModel.updateUser(user.id, { digilockerStatus: 'CONSENT_COMPLETED' }, tx);
    });

    logger.info(`[DIGILOCKER] e-Aadhaar fetched and saved for user ${user.id}`);

    return { userId: user.id, saved: true ,data: eAadhaar};
  }
}

module.exports = new AadhaarService();
