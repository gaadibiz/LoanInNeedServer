const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PanModel = {
  /**
   * Find PAN verification record by userId
   */
  async findByUserId(userId, tx = prisma) {
    const client = tx;
    return client.panVerification.findUnique({
      where: { userId },
    });
  },

  /**
   * Find PAN verification record by ID
   */
  async findById(id, tx = prisma) {
    const client = tx;
    return client.panVerification.findUnique({
      where: { id },
    });
  },

  /**
   * Create new PAN verification record
   */
  async createPanRecord(userId, panNumber, tx = prisma) {
    const client = tx;
    return client.panVerification.create({
      data: {
        userId,
        panNumber,
        verified: false,
      },
    });
  },

  /**
   * Update PAN verification record
   */
  async updatePanRecord(userId, data, tx = prisma) {
    const client = tx;
    return client.panVerification.update({
      where: { userId },
      data,
    });
  },

  /**
   * Verify PAN (set verified = true and verifiedAt = now)
   */
  async verifyPan(userId, tx = prisma) {
    const client = tx;
    return client.panVerification.update({
      where: { userId },
      data: {
        verified: true,
        verifiedAt: new Date(),
      },
    });
  },

  /**
   * Delete PAN verification record
   */
  async deletePanRecord(userId, tx = prisma) {
    const client = tx;
    return client.panVerification.delete({
      where: { userId },
    });
  },
};

module.exports = PanModel;
