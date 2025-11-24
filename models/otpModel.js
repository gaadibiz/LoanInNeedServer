const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const OtpModel = {
  async createOtpRecord(userId, otpCode, expiresAt) {
    return prisma.otpVerification.create({
      data: {
        otpCode,
        expiresAt,
        userId,
      },
    });
  },

  async findLatestByUserId(userId) {
    return prisma.otpVerification.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async verifyOtp(userId, otpCode) {
    const otpRecord = await prisma.otpVerification.findFirst({
      where: {
        userId,
        otpCode,
        verified: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord || otpRecord.expiresAt < new Date()) {
      return null;
    }

    return prisma.otpVerification.update({
      where: { id: otpRecord.id },
      data: { verified: true },
    });
  },
};

module.exports = OtpModel;
