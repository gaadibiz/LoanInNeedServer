const prisma = require('../utils/prismaClient');

const UtmModel = {
  /**
   * Find UTM record by userId
   */
  async findByUserId(userId, tx = prisma) {
    const client = tx;
    return client.utm.findUnique({
      where: { userId },
    });
  },

  /**
   * Upsert the UTM attribution params for a user: creates a record if none
   * exists yet, otherwise updates the existing one.
   */
  async saveUtm(userId, { utmSource, utmMedium, utmCampaign, utmId, utmTerm, utmContent }, tx = prisma) {
    const client = tx;
    const data = { utmSource, utmMedium, utmCampaign, utmId, utmTerm, utmContent };

    return client.utm.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
  },
};

module.exports = UtmModel;
