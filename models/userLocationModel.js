const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const UserLocationModel = {
  async createLocation(userId, data, tx = prisma) {
    return tx.userLocation.create({
      data: { ...data, userId },
    });
  },

  async getLatestLocation(userId, tx = prisma) {
    return tx.userLocation.findFirst({
      where: { userId },
      orderBy: { capturedAt: "desc" },
    });
  },

  async getUserLocations(userId, tx = prisma) {
    return tx.userLocation.findMany({
      where: { userId },
      orderBy: { capturedAt: "desc" },
    });
  }
};

module.exports = UserLocationModel;
