const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { generateToken } = require('../utils/jwt');
const twilioOtp = require('../utils/twilioOtp');
const logger = require('../utils/logger');
const { BadRequestError } = require('../GlobalExceptionHandler/exception');

const TEST_PHONE_NUMBER = process.env.TEST_PHONE_NUMBER || null;

// ==============================
// Send OTP to Phone (Twilio)
// ==============================
async function requestPhoneOtp(phone) {
  const targetPhone = TEST_PHONE_NUMBER || phone;

  logger.info('Request phone OTP for: %s', targetPhone);

  if (!targetPhone.startsWith('+')) {
    logger.warn('Invalid phone number format: %s', targetPhone);
    throw new BadRequestError('Phone number must include country code, e.g., +919830069363');
  }

  await twilioOtp.sendOtp(targetPhone);
  logger.info('OTP sent successfully to: %s', targetPhone);

  return { message: 'OTP sent successfully.' };
}

// ==============================
// Verify OTP (Twilio) and Create or Update User
// ==============================
async function verifyPhoneOtp(phone, code) {
  const targetPhone = TEST_PHONE_NUMBER || phone;
  logger.info('Verifying OTP for phone: %s', targetPhone);

  if (!targetPhone || !code) {
    throw new BadRequestError('Phone and OTP code are required.');
  }

  const verificationCheck = await twilioOtp.verifyOtp(targetPhone, code);

  if (!verificationCheck || verificationCheck.status !== 'approved') {
    logger.warn('Phone OTP verification failed for: %s', targetPhone);
    throw new BadRequestError('Invalid or expired OTP.');
  }

  // Check if user already exists
  let user = await prisma.user.findUnique({ where: { phone: targetPhone } });

  if (!user) {
    // Generate custom user ID
    const lastUser = await prisma.user.findFirst({ orderBy: { id: 'desc' } });
    const nextNumber = ((lastUser?.id || 0) + 1).toString().padStart(3, '0');
    const customUserId = `LIN${nextNumber}`;

    user = await prisma.user.create({
      data: {
        customUserId,
        phone: targetPhone,
        phoneVerified: true,
        phoneVerifiedAt: new Date(),
        role: 'CUSTOMER',
        verificationStatus: 'PENDING'
      }
    });

    logger.info('New user created and verified: %s (customId=%s)', targetPhone, customUserId);
  } else if (!user.phoneVerified) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        phoneVerified: true,
        phoneVerifiedAt: new Date()
      }
    });
    logger.info('Existing user verified: %s (customId=%s)', targetPhone, user.customUserId);
  } else {
    logger.info('User already verified: %s (customId=%s)', targetPhone, user.customUserId);
  }

  const token = generateToken(user);

  return {
    message: 'Phone verified successfully.',
    user: {
      id: user.customUserId,
      phone: user.phone,
      role: user.role,
      verificationStatus: user.verificationStatus
    },
    token
  };
}

module.exports = { requestPhoneOtp, verifyPhoneOtp };
