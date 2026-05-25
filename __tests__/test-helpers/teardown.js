const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const logger = require('../utils/logger');

afterAll(async () => {
  // Remove any test users created during tests
  await prisma.user.deleteMany({
    where: {
      phone: { startsWith: '+91000' }, // only remove test phone numbers
    },
  });
  logger.info('🧹 Test users cleaned up after tests');

  // Disconnect Prisma
  await prisma.$disconnect();
  logger.info('🔴 Test DB disconnected');
});
