const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const AadhaarModel = {
  /**
   * Find Aadhaar verification record by userId
   */
  async findByUserId(userId, tx = prisma) {
    const client = tx;
    return client.aadhaarVerification.findUnique({
      where: { userId },
    });
  },

  /**
   * Find Aadhaar verification record by ID
   */
  async findById(id, tx = prisma) {
    const client = tx;
    return client.aadhaarVerification.findUnique({
      where: { id },
    });
  },

  /**
   * Create new Aadhaar verification record
   */
  async createAadhaarRecord(userId, aadhaarNumber, tx = prisma) {
    const client = tx;
    return client.aadhaarVerification.create({
      data: {
        userId,
        aadhaarNumber,
        verified: false,
      },
    });
  },

  /**
   * Update Aadhaar verification record
   */
  async updateAadhaarRecord(userId, data, tx = prisma) {
    const client = tx;
    return client.aadhaarVerification.update({
      where: { userId },
      data,
    });
  },

  /**
   * Verify Aadhaar (set verified = true and verifiedAt = now)
   */
  async verifyAadhaar(userId, tx = prisma) {
    const client = tx;
    return client.aadhaarVerification.update({
      where: { userId },
      data: {
        verified: true,
        verifiedAt: new Date(),
      },
    });
  },

  /**
   * Delete Aadhaar verification record
   */
  async deleteAadhaarRecord(userId, tx = prisma) {
    const client = tx;
    return client.aadhaarVerification.delete({
      where: { userId },
    });
  },
};

module.exports = AadhaarModel;
