const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const PanModel = require('../models/panModel');
const { BadRequestError, NotFoundError } = require('../GlobalExceptionHandler/exception');

class PanService {

  /**
   * Mask PAN number - shows only last 4 characters
   * Example: ABCDE1234F -> ****E1234F
   */
  maskPAN(pan) {
    return pan.replace(/.(?=....)/g, "*");
  }

  /**
   * Validate PAN number format
   * Format: 5 letters + 4 digits + 1 letter (e.g., ABCDE1234F)
   */
  validatePANFormat(pan) {
    const regex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    return regex.test(pan);
  }

  /**
   * Submit PAN number - creates or updates record
   */
  async submitPAN(userId, number) {
    if (!number) throw new BadRequestError("PAN number is required");

    const panUpper = number.toUpperCase().trim();
    if (!this.validatePANFormat(panUpper)) {
      throw new BadRequestError("Invalid PAN format. Expected format: ABCDE1234F");
    }

    // Mask the PAN before storing
    const masked = this.maskPAN(panUpper);

    return prisma.$transaction(async (tx) => {
      const existing = await PanModel.findByUserId(userId, tx);

      if (existing) {
        // Update existing record
        return PanModel.updatePanRecord(userId, {
          panNumber: masked,
          verified: false,
          verifiedAt: null
        }, tx);
      }

      // Create new record
      return PanModel.createPanRecord(userId, masked, tx);
    });
  }

  /**
   * Get PAN verification status
   */
  async getPanStatus(userId) {
    const data = await PanModel.findByUserId(userId);
    if (!data) throw new NotFoundError("PAN not submitted");

    return {
      panNumber: data.panNumber, // already masked in DB
      verified: data.verified,
      verifiedAt: data.verifiedAt,
      submittedAt: data.createdAt || null
    };
  }

  /**
   * Verify PAN - typically called by admin/automated system
   */
  async verifyPAN(userId) {
    return prisma.$transaction(async (tx) => {
      const existing = await PanModel.findByUserId(userId, tx);
      if (!existing) throw new NotFoundError("PAN record not found");

      const updated = await PanModel.verifyPan(userId, tx);
      return { message: "PAN verified successfully", updated };
    });
  }

  /**
   * Get full PAN details (admin only)
   */
  async getPanDetails(userId) {
    const data = await PanModel.findByUserId(userId);
    if (!data) throw new NotFoundError("PAN record not found");
    return data;
  }
}

module.exports = new PanService();
