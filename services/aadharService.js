const prisma = require('../utils/prismaClient');
const AadhaarModel = require('../models/aadhaarModel');
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
}

module.exports = new AadhaarService();
