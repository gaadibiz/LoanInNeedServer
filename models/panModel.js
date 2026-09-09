const prisma = require('../utils/prismaClient');

const PanModel = {
  /**
   * Find PAN verification record by userId
   */
  async findByUserId(userId, tx = prisma) {
    const client = tx;
    return client.panVerification.findUnique({
      where: { userId },
      select: {
        id: true,
        userId: true,
        panNumber: true,
        aadhaar_linked: true,
        masked_aadhaar: true,
        verified: true,
        verifiedAt: true,
      },
    });
  },

  /**
   * Find PAN verification record by PAN Number
   */
  async findByPanNumber(panNumber, tx = prisma) {
    const client = tx;
    return client.panVerification.findUnique({
      where: { panNumber },
      select: {
        id: true,
        userId: true,
        panNumber: true,
        aadhaar_linked: true,
        masked_aadhaar: true,
        verified: true,
        verifiedAt: true,
      },
    });
  },

  /**
   * Find PAN verification record by ID
   */
  async findById(id, tx = prisma) {
    const client = tx;
    return client.panVerification.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        panNumber: true,
        aadhaar_linked: true,
        masked_aadhaar: true,
        verified: true,
        verifiedAt: true,
      },
    });
  },

  /**
   * Create new PAN verification record
   */
  async createPanRecord(userId, panDataOrNumber, tx = prisma) {
    const client = tx;
    const payload =
      typeof panDataOrNumber === 'string'
        ? { userId, panNumber: panDataOrNumber, verified: false }
        : { userId, verified: false, ...panDataOrNumber };
    return client.panVerification.create({
      data: payload,
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
