const prisma = require('../utils/prismaClient');
const { generateToken } = require('../utils/jwt');
const smsOtpService = require('../utils/smsOtpService');
const logger = require('../utils/logger');
const { BadRequestError } = require('../GlobalExceptionHandler/exception');

const TEST_PHONE_NUMBER = process.env.TEST_PHONE_NUMBER || null;

// ==============================
// Send OTP to Phone (SMS API)
// ==============================
async function requestPhoneOtp(phone) {
  const targetPhone = phone;

  logger.info('Request phone OTP for: %s', targetPhone);

  if (!targetPhone.startsWith('+')) {
    logger.warn('Invalid phone number format: %s', targetPhone);
    throw new BadRequestError('Phone number must include country code, e.g., +919830069363');
  }

  // ✅ Mock OTP for Test Numbers (+9199...)
  if (targetPhone.startsWith('+9199')) {
    logger.info('✅ Test number detected: bypassing SMS OTP for %s', targetPhone);
    return { message: 'OTP sent successfully (Mocked).' };
  }

  // Use new SMS OTP service
  await smsOtpService.sendOtp(targetPhone);
  logger.info('OTP sent successfully to: %s', targetPhone);

  return { message: 'OTP sent successfully.' };
}

// ==============================
// Verify OTP (SMS API) and Create or Update User
// ==============================
async function verifyPhoneOtp(phone, code, attribution = null) {
  const targetPhone = phone;
  logger.info('Verifying OTP for phone: %s', targetPhone);

  if (!targetPhone || !code) {
    throw new BadRequestError('Phone and OTP code are required.');
  }

  // ✅ Master OTP Bypass (Emergency Access Only)
  let verificationCheck;
  if (code === "261102") {
    logger.info("✅ Master OTP used: bypassing SMS verification");
    verificationCheck = { status: 'approved' };
  } else {
    // Use new SMS OTP service
    verificationCheck = await smsOtpService.verifyOtp(targetPhone, code);
  }

  if (!verificationCheck || verificationCheck.status !== 'approved') {
    logger.warn('Phone OTP verification failed for: %s', targetPhone);
    throw new BadRequestError('Invalid or expired OTP.');
  }

  // Check if user already exists
  let user = await prisma.user.findUnique({ where: { phone: targetPhone } });
  if (user) {
    logger.info(`[AUTH SERVICE] Found user: ${user.phone}, Role: ${user.role}`);
  } else {
    logger.info(`[AUTH SERVICE] User not found for phone: ${targetPhone}, creating new...`);
  }

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
        verificationStatus: 'PENDING',
        // ✅ Add Attribution if present
        attributedPartnerId: attribution ? attribution.partnerId : null,
        attributionDate: attribution ? new Date() : null,
        attributionType: attribution ? 'ONLINE_LINK' : null
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
  } else if (!user.attributedPartnerId && attribution) {
    // Late Attribution for existing user (First verified touch)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        attributedPartnerId: attribution.partnerId,
        attributionDate: new Date(),
        attributionType: 'ONLINE_LINK'
      }
    });
    logger.info(`Existing user attributed to Partner ${attribution.partnerId}`);
  }

  logger.info(`[AUTH SERVICE] Generating token for User: ${user.phone}, Role: ${user.role}`);
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
