const prisma = require('../utils/prismaClient');
const { generateToken } = require('../utils/jwt');
const smsOtpService = require('../utils/smsOtpService');
const emailOtpService = require('../utils/emailOtpService');
const logger = require('../utils/logger');
const { BadRequestError } = require('../GlobalExceptionHandler/exception');
const { sendLoanApplicationToBumchum } = require('../services/loanService');
const UtmModel = require('../models/utmModel');
const AddressModel = require('../models/adressModel');

const TEST_PHONE_NUMBER = process.env.TEST_PHONE_NUMBER || null;

// ==============================
// Save UTM attribution params for a user, if any were sent
// ==============================
async function saveUtmIfPresent(userId, utm) {
  if (!utm) return;

  const hasUtm = Object.values(utm).some((value) => !!value);
  if (!hasUtm) return;

  try {
    await UtmModel.saveUtm(userId, utm);
    logger.info('UTM attribution saved for user %s: %o', userId, utm);
  } catch (error) {
    logger.error('Failed to save UTM attribution for user %s', userId, error);
  }
}

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
  // Check if user already exists
  const existingUser = await prisma.user.findUnique({ where: { phone: targetPhone } });
  const isExistingUser = !!existingUser;

  // Use new SMS OTP service
  await smsOtpService.sendOtp(targetPhone);

  logger.info('OTP sent successfully to %s (existingUser=%s)', targetPhone, isExistingUser);

  return { message: 'OTP sent successfully.', isExistingUser };
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

  verificationCheck = await smsOtpService.verifyOtp(targetPhone, code);


  if (!verificationCheck || verificationCheck.status !== 'approved') {
    logger.warn('Phone OTP verification failed for: %s', targetPhone);
    throw new BadRequestError('Invalid or expired OTP.');
  }

  // Check if user already exists
  let user = await prisma.user.findUnique({ where: { phone: targetPhone }, select: { id: true, role: true } });
  if (user) {
    logger.info(`[AUTH SERVICE] Found user: ${user.phone}, Role: ${user.role}`);
  } else {
    logger.info(`[AUTH SERVICE] User not found for phone: ${targetPhone}, creating new...`);
  }



  if (!user) {
    // ✅ Fixed Concurrency Bug: Let Postgres generate the unique ID first, then update customUserId
    user = await prisma.user.create({
      data: {
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

    const customUserId = `LIN${user.id.toString().padStart(3, '0')}`;
    user = await prisma.user.update({
      where: { id: user.id },
      data: { customUserId }
    });

    try {
      console.log("[BUMCHUM] Sending Loan Application to Bumchum", user.id);
      if (user) {
        await sendLoanApplicationToBumchum(user.id, '');
      }
    } catch (error) {
      console.log(error, "[ERROR] Error sending loan application to Bumchum");
    }
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

  // Fetch profile completeness for the frontend to decide next step
  const hasName = !!user.name;
  const hasPan = !!(await prisma.panVerification.findUnique({ where: { userId: user.id } }));
  const hasAadhaar = !!(await prisma.aadhaarVerification.findUnique({ where: { userId: user.id } }));
  const isProfileComplete = hasName && hasPan && hasAadhaar;

  return {
    message: 'Phone verified successfully.',
    user: {
      userId: user.id,
      id: user.customUserId,
      phone: user.phone,
      role: user.role,
      verificationStatus: user.verificationStatus
    },
    token,
    isExistingUser: !!(await prisma.user.findUnique({ where: { id: user.id }, select: { phoneVerifiedAt: true, name: true } }))?.name,
    isProfileComplete
  };
}


// ==============================
// Register Phone number and Create or Update User
// ==============================
async function registerPhone(phone, attribution = null, data) {
  logger.info('Register phone OTP for: %s', phone);
  const targetPhone = phone;
  logger.info('Requested phone: %s', targetPhone);

  if (!targetPhone) {
    throw new BadRequestError('Phone is required.');
  }

  // Check if user already exists
  let user = await prisma.user.findUnique({ where: { phone: targetPhone } });
  if (user) {
    logger.info(`[AUTH SERVICE] Found user: ${user.phone}, Role: ${user.role}`);
  } else {
    logger.info(`[AUTH SERVICE] User not found for phone: ${targetPhone}, creating new...`);
  }

  if (!user) {
    // ✅ Fixed Concurrency Bug: Let Postgres generate the unique ID first, then update customUserId
    user = await prisma.user.create({
      data: {
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

    const customUserId = `LIN${user.id.toString().padStart(3, '0')}`;
    user = await prisma.user.update({
      where: { id: user.id },
      data: { customUserId }
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

  // Fetch profile completeness for the frontend to decide next step
  const hasName = !!user.name;
  const hasPan = !!(await prisma.panVerification.findUnique({ where: { userId: user.id } }));
  const hasAadhaar = !!(await prisma.aadhaarVerification.findUnique({ where: { userId: user.id } }));
  const isProfileComplete = hasName && hasPan && hasAadhaar;

  if (data && data?.city) {
    try {
      await AddressModel.upsertAddress(user.id, { city: data.city });
    } catch (error) {
      logger.error('Failed to save city for user %s', user.id, error);
    }
  }

  return {
    message: 'Phone verified successfully.',
    user: {
      id: user.customUserId,
      phone: user.phone,
      role: user.role,
      verificationStatus: user.verificationStatus
    },
    token,
    isExistingUser: !!(await prisma.user.findUnique({ where: { id: user.id }, select: { phoneVerifiedAt: true, name: true } }))?.name,
    isProfileComplete
  };
}

// ==============================
// Send OTP to Email
// ==============================
async function requestEmailOtp(email, userId = null) {
  let targetEmail = email;

  // If userId provided but no email, fetch user's saved email
  if (!targetEmail && userId) {
    const user = await prisma.user.findUnique({
      where: { id: Number(userId) },
      select: { email: true }
    });
    if (user && user.email) {
      targetEmail = user.email;
    }
  }

  if (!targetEmail || typeof targetEmail !== 'string' || !targetEmail.includes('@')) {
    throw new BadRequestError('A valid email address is required.');
  }

  targetEmail = targetEmail.trim().toLowerCase();
  logger.info(`[AUTH SERVICE] Request email OTP for: ${targetEmail} (userId=${userId || 'anonymous'})`);

  // Check if another user already has this email registered
  if (userId) {
    const existingUserWithEmail = await prisma.user.findUnique({
      where: { email: targetEmail },
      select: { id: true }
    });
    if (existingUserWithEmail && existingUserWithEmail.id !== Number(userId)) {
      throw new BadRequestError('This email is already registered to another account.');
    }
  }

  const result = await emailOtpService.sendOtp(targetEmail);
  return {
    success: true,
    message: 'OTP sent to email successfully.',
    email: targetEmail,
    channel: result.channel
  };
}

// ==============================
// Verify OTP from Email and Update User
// ==============================
async function verifyEmailOtp(email, code, userId = null) {
  let targetEmail = email;

  if (!targetEmail && userId) {
    const user = await prisma.user.findUnique({
      where: { id: Number(userId) },
      select: { email: true }
    });
    if (user && user.email) {
      targetEmail = user.email;
    }
  }

  if (!targetEmail || !code) {
    throw new BadRequestError('Email and OTP code are required.');
  }

  targetEmail = targetEmail.trim().toLowerCase();
  logger.info(`[AUTH SERVICE] Verifying email OTP for: ${targetEmail} (userId=${userId || 'anonymous'})`);

  const verificationCheck = await emailOtpService.verifyOtp(targetEmail, code);

  if (!verificationCheck || verificationCheck.status !== 'approved') {
    logger.warn(`[AUTH SERVICE] Email OTP verification failed for: ${targetEmail}`);
    throw new BadRequestError('Invalid or expired OTP.');
  }

  let updatedUser = null;

  if (userId) {
    // If logged in, update this user's email and emailVerified status
    updatedUser = await prisma.user.update({
      where: { id: Number(userId) },
      data: {
        email: targetEmail,
        emailVerified: true,
        emailVerifiedAt: new Date()
      },
      select: {
        id: true,
        customUserId: true,
        email: true,
        emailVerified: true,
        emailVerifiedAt: true
      }
    });
    logger.info(`[AUTH SERVICE] User ${userId} email verified: ${targetEmail}`);
  } else {
    // If not logged in, update user if an account exists with this email
    const existingUser = await prisma.user.findUnique({
      where: { email: targetEmail },
      select: { id: true }
    });

    if (existingUser) {
      updatedUser = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          emailVerified: true,
          emailVerifiedAt: new Date()
        },
        select: {
          id: true,
          customUserId: true,
          email: true,
          emailVerified: true,
          emailVerifiedAt: true
        }
      });
      logger.info(`[AUTH SERVICE] Existing user ${existingUser.id} email verified: ${targetEmail}`);
    }
  }

  return {
    success: true,
    message: 'Email verified successfully.',
    email: targetEmail,
    emailVerified: true,
    user: updatedUser
  };
}

module.exports = {
  requestPhoneOtp,
  verifyPhoneOtp,
  registerPhone,
  saveUtmIfPresent,
  requestEmailOtp,
  verifyEmailOtp
};
