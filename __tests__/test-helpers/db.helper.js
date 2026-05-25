const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Database Test Helper
 * Provides utilities for database operations in tests
 */
class DbHelper {
  /**
   * Start a transaction for test isolation
   */
  static async startTransaction() {
    return await prisma.$transaction(async (tx) => {
      return tx;
    });
  }

  /**
   * Clean up test data
   */
  static async cleanupTestData() {
    try {
      // Delete in reverse order of dependencies
      await prisma.userLocation.deleteMany({
        where: {
          user: {
            phone: { startsWith: '+91000' },
          },
        },
      });

      await prisma.userDocument.deleteMany({
        where: {
          user: {
            phone: { startsWith: '+91000' },
          },
        },
      });

      await prisma.losIntegrationJob.deleteMany({
        where: {
          user: {
            phone: { startsWith: '+91000' },
          },
        },
      });

      await prisma.loanApplication.deleteMany({
        where: {
          user: {
            phone: { startsWith: '+91000' },
          },
        },
      });

      await prisma.employmentDetail.deleteMany({
        where: {
          user: {
            phone: { startsWith: '+91000' },
          },
        },
      });

      await prisma.addressDetail.deleteMany({
        where: {
          user: {
            phone: { startsWith: '+91000' },
          },
        },
      });

      await prisma.aadhaarVerification.deleteMany({
        where: {
          user: {
            phone: { startsWith: '+91000' },
          },
        },
      });

      await prisma.panVerification.deleteMany({
        where: {
          user: {
            phone: { startsWith: '+91000' },
          },
        },
      });

      await prisma.otpVerification.deleteMany({
        where: {
          user: {
            phone: { startsWith: '+91000' },
          },
        },
      });

      await prisma.loan.deleteMany({
        where: {
          user: {
            phone: { startsWith: '+91000' },
          },
        },
      });

      await prisma.user.deleteMany({
        where: {
          phone: { startsWith: '+91000' },
        },
      });
    } catch (error) {
      console.error('Error cleaning up test data:', error);
    }
  }

  /**
   * Get test user by phone
   */
  static async getTestUser(phone) {
    return await prisma.user.findUnique({
      where: { phone },
      include: {
        employment: true,
        address: true,
        aadhaarVerification: true,
        panVerification: true,
        documents: true,
        locations: true,
      },
    });
  }

  /**
   * Create a test user
   */
  static async createTestUser(userData) {
    return await prisma.user.create({
      data: userData,
    });
  }

  /**
   * Delete a test user and all related data
   */
  static async deleteTestUser(userId) {
    await prisma.userLocation.deleteMany({ where: { userId } });
    await prisma.userDocument.deleteMany({ where: { userId } });
    await prisma.losIntegrationJob.deleteMany({ where: { userId } });
    await prisma.loanApplication.deleteMany({ where: { userId } });
    await prisma.employmentDetail.deleteMany({ where: { userId } });
    await prisma.addressDetail.deleteMany({ where: { userId } });
    await prisma.aadhaarVerification.deleteMany({ where: { userId } });
    await prisma.panVerification.deleteMany({ where: { userId } });
    await prisma.otpVerification.deleteMany({ where: { userId } });
    await prisma.loan.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
  }

  /**
   * Disconnect Prisma
   */
  static async disconnect() {
    await prisma.$disconnect();
  }
}

module.exports = DbHelper;

