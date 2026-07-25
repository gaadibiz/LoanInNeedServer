const prisma = require('../utils/prismaClient');

const PhonePrefillModel = {
  /**
   * Find phone prefill record by userId
   */
  async findByUserId(userId, tx = prisma) {
    const client = tx;
    return client.phonePrefillDetail.findUnique({
      where: { userId },
    });
  },

  /**
   * Upsert the full phone-prefill payload fetched from Signzy's
   * Phone-to-Prefill API, storing the response as-is in the `response` JSON column.
   */
  async savePrefillDetails(userId, { phoneNumber, pan, firstName, lastName, response }, tx = prisma) {
    const client = tx;
    const data = {
      phoneNumber,
      pan,
      firstName,
      lastName,
      response,
      fetchedAt: new Date(),
    };

    return client.phonePrefillDetail.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
  },

  /**
   * Delete phone prefill record
   */
  async deleteByUserId(userId, tx = prisma) {
    const client = tx;
    return client.phonePrefillDetail.delete({
      where: { userId },
    });
  },
};

module.exports = PhonePrefillModel;
