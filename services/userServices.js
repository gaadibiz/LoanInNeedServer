// services/userService.js
const prisma = require('../utils/prismaClient');
const logger = require('../utils/logger');
const { hashPassword } = require('../utils/hash');
const { BadRequestError, NotFoundError, UnauthorizedError } = require('../GlobalExceptionHandler/exception');
const smsOtpService = require('../utils/smsOtpService');
const { comparePassword } = require('../utils/hash');
const jwt = require('jsonwebtoken');

/**
 * =====================================
 * Basic Registration (After OTP Verify)
 * =====================================
 */
async function registerUser(userId, data) {
  logger.info(`📌 [USER SERVICE] Starting registration for userId: ${userId}`);

  // 1️⃣ Fetch user by ID
  const user = await prisma.user.findUnique({ where: { id: Number(userId) } });

  if (!user) {
    logger.error(`❌ [USER SERVICE] User not found for ID: ${userId}`);
    throw new NotFoundError('User not found.');
  }

  if (!user.phoneVerified) {
    logger.warn(`⚠️ [USER SERVICE] Phone not verified for userId: ${userId}`);
    throw new BadRequestError('Phone must be verified before registration.');
  }

  const { name, dob, gender, email, password } = data;

  // 2️⃣ Validate required fields
  // Email and Password are now OPTIONAL. Only Name, DOB, Gender required.
  if (!name || !dob || !gender) {
    logger.error('❌ [USER SERVICE] Missing required fields for registration');
    throw new BadRequestError('name, dob, & gender are required.');
  }

  // 3️⃣ Validate email uniqueness if updated
  if (email && email !== user.email) {
    const emailExists = await prisma.user.findUnique({ where: { email } });
    if (emailExists) {
      logger.error(`❌ [USER SERVICE] Email already registered: ${email}`);
      throw new BadRequestError('Email already registered.');
    }
  }

  const updateData = {
    name,
    dob: new Date(dob),
    gender: gender.toUpperCase(),
    email: email || null,
    password: password ? await hashPassword(password) : null,
  };

  // 5️⃣ Update user in DB
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: updateData,
  });

  logger.info(`✅ [USER SERVICE] Registration completed for customUserId: ${updatedUser.customUserId}`);

  // 6️⃣ Return minimal user info
  return {
    message: 'Registration completed successfully.',
    user: {
      id: updatedUser.customUserId,
      phone: updatedUser.phone,
      name: updatedUser.name,
      email: updatedUser.email,
      dob: updatedUser.dob,
      gender: updatedUser.gender,
    },
  };
}
/**
 * ==============================
 * Login with Phone + OTP
 * ==============================
 */
async function loginViaPhone(phone) {
  logger.info(`📌 [USER SERVICE] Login attempt via phone: ${phone}`);

  if (!phone) {
    throw new BadRequestError("Phone number is required.");
  }

  // ✅ Find user with same phone
  const user = await prisma.user.findFirst({
    where: {
      phone
    }
  });

  if (!user) {
    logger.warn(`❌ Login failed: No user matched phone: ${phone}`);
    throw new UnauthorizedError("User not found or credentials incorrect.");
  }

  if (!user.phoneVerified) {
    throw new BadRequestError("Phone not verified! Please verify phone OTP first.");
  }

  // ✅ Send OTP for login
  await smsOtpService.sendOtp(phone);
  logger.info(`✅ OTP sent for login to ${phone}`);

  return {
    message: "OTP sent for login. Please verify to continue.",
    phone
  };
}

/**
 * ==============================
 * Fetch Profile /me
 * ==============================
 */
async function getProfile(userId) {
  logger.info(`📌 [USER SERVICE] Fetching profile for userId: ${userId}`);

  const user = await prisma.user.findUnique({ where: { id: Number(userId) } });

  if (!user) {
    logger.error(`❌ [USER SERVICE] User not found for ID: ${userId}`);
    throw new NotFoundError('User not found.');
  }

  logger.info(`✅ [USER SERVICE] Profile fetched successfully for userId: ${userId}`);
  return user;
}

/**
 * ==============================
 * Fetch Complete Profile with all KYC and related data
 * ==============================
 */
async function getCompleteProfile(userId) {
  logger.info(`📌 [USER SERVICE] Fetching complete profile for userId: ${userId}`);

  const user = await prisma.user.findUnique({
    where: { id: Number(userId) },
    include: {
      aadhaarVerification: true,
      panVerification: true,
      employment: true,
      address: true,
      documents: {
        orderBy: { uploadedAt: 'desc' }
      },
      locations: {
        orderBy: { capturedAt: 'desc' },
        take: 10 // Get latest 10 locations
      },
      loanApplications: {
        orderBy: { createdAt: 'desc' },
        include: {
          employmentDetail: true
        }
      },
      loans: {
        orderBy: { createdAt: 'desc' }
      },
      status: true
    }
  });

  if (!user) {
    logger.error(`❌ [USER SERVICE] User not found for ID: ${userId}`);
    throw new NotFoundError('User not found.');
  }

  // Remove sensitive data
  const { password, ...userWithoutPassword } = user;

  // Get latest location separately (for backward compatibility)
  const latestLocation = user.locations && user.locations.length > 0
    ? user.locations[0]
    : null;

  // Calculate KYC completion status
  const kycStatus = {
    aadhaarVerified: user.aadhaarVerification?.verified || false,
    panVerified: user.panVerification?.verified || false,
    employmentAdded: !!user.employment,
    addressAdded: !!user.address,
    documentsUploaded: user.documents?.length > 0 || false,
    selfieUploaded: user.documents?.some(doc => doc.docType === 'PHOTO') || false,
    locationCaptured: !!latestLocation
  };

  // Count documents by type
  const documentSummary = {
    total: user.documents?.length || 0,
    byType: {
      AADHAAR: user.documents?.filter(doc => doc.docType === 'AADHAAR').length || 0,
      PAN: user.documents?.filter(doc => doc.docType === 'PAN').length || 0,
      PAY_SLIP: user.documents?.filter(doc => doc.docType === 'PAY_SLIP').length || 0,
      BANK_STATEMENT: user.documents?.filter(doc => doc.docType === 'BANK_STATEMENT').length || 0,
      PHOTO: user.documents?.filter(doc => doc.docType === 'PHOTO').length || 0,
      SIGNATURE: user.documents?.filter(doc => doc.docType === 'SIGNATURE').length || 0
    }
  };

  const completeProfile = {
    ...userWithoutPassword,
    latestLocation,
    kycStatus,
    documentSummary
  };

  logger.info(`✅ [USER SERVICE] Complete profile fetched successfully for userId: ${userId}`);
  return completeProfile;
}

/**
 * ==============================
 * Admin Login (Email + Password)
 * ==============================
 */
async function loginAdmin(email, password) {
  logger.info(`📌 [USER SERVICE] Admin login attempt: ${email}`);

  if (!email || !password) {
    throw new BadRequestError('Email and Password are required.');
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw new UnauthorizedError('Invalid credentials.');
  }

  // Check Role
  if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
    throw new UnauthorizedError('Access Denied: Not an Admin.');
  }

  // Verify Password
  if (!user.password) {
    throw new UnauthorizedError('Account does not have a password set.');
  }

  const isMatch = await comparePassword(password, user.password);
  if (!isMatch) {
    throw new UnauthorizedError('Invalid credentials.');
  }

  // Generate Token
  const token = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );

  logger.info(`✅ [USER SERVICE] Admin logged in: ${email}`);

  return {
    message: 'Admin logged in successfully',
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    }
  };
}

module.exports = {
  registerUser,
  getProfile,
  getCompleteProfile,
  loginViaPhone,
  loginAdmin
};
