const prisma = require('./prismaClient');
const logger = require('./logger');
const emailService = require('../services/emailService');

const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES || '10', 10);
const DEV_BYPASS_CODE = '261102';

/**
 * Generate a random 6-digit OTP code
 */
function generateOtpCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send OTP via Email
 * @param {string} email - Recipient email address
 * @returns {Promise<Object>} - Verification status and details
 */
async function sendOtp(email) {
  if (!email || !email.includes('@')) {
    throw new Error('Valid email address is required');
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    // Generate OTP code
    const otpCode = generateOtpCode();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Store OTP in database
    await prisma.emailOtp.create({
      data: {
        email: normalizedEmail,
        code: otpCode,
        expiresAt,
        verified: false,
      },
    });

    // Check if DEV OTP Bypass is active
    const ENABLE_DEV_OTP_BYPASS = process.env.ENABLE_DEV_OTP_BYPASS === 'true';

    if (ENABLE_DEV_OTP_BYPASS) {
      await prisma.emailOtp.updateMany({
        where: { email: normalizedEmail, code: otpCode, verified: false },
        data: { code: DEV_BYPASS_CODE },
      });

      logger.info(`🔓 [DEV BYPASS] Email OTP bypass enabled for ${normalizedEmail}. Use code: ${DEV_BYPASS_CODE}`);

      return {
        status: 'pending',
        to: normalizedEmail,
        channel: 'email',
        message: `Development bypass - use code ${DEV_BYPASS_CODE}`,
      };
    }

    // Dispatch email via Nodemailer SMTP service
    await emailService.sendOtpEmail(normalizedEmail, otpCode, OTP_EXPIRY_MINUTES);

    logger.info(`✅ [EMAIL OTP] OTP sent successfully to ${normalizedEmail}`);

    return {
      status: 'pending',
      to: normalizedEmail,
      channel: 'email',
      message: 'OTP sent to email successfully',
    };
  } catch (error) {
    logger.error(`❌ [EMAIL OTP] Send error for ${normalizedEmail}: ${error.message}`);

    // Clean up failed OTP record from database (created in last 1 minute)
    await prisma.emailOtp.deleteMany({
      where: {
        email: normalizedEmail,
        verified: false,
        createdAt: {
          gte: new Date(Date.now() - 60000),
        },
      },
    }).catch(() => {});

    throw new Error(`Failed to send email OTP: ${error.message}`);
  }
}

/**
 * Verify Email OTP code
 * @param {string} email - Target email address
 * @param {string} code - 6-digit OTP code to verify
 * @returns {Promise<Object>} - Verification result
 */
async function verifyOtp(email, code) {
  if (!email || !code) {
    throw new Error('Email and OTP code are required.');
  }

  const normalizedEmail = email.trim().toLowerCase();
  const trimmedCode = String(code).trim();

  try {
    const ENABLE_DEV_OTP_BYPASS = process.env.ENABLE_DEV_OTP_BYPASS === 'true';

    // Master OTP / Dev bypass (Emergency Access)
    if (trimmedCode === DEV_BYPASS_CODE || (ENABLE_DEV_OTP_BYPASS && trimmedCode === DEV_BYPASS_CODE)) {
      logger.info(`🔓 [EMAIL OTP] Master OTP / Bypass used for ${normalizedEmail}`);
      await prisma.emailOtp.updateMany({
        where: { email: normalizedEmail, verified: false },
        data: { verified: true },
      });

      return {
        status: 'approved',
        to: normalizedEmail,
        valid: true,
        message: 'OTP verified successfully (Master Bypass)',
      };
    }

    // Find the most recent unverified OTP for this email
    const otpRecord = await prisma.emailOtp.findFirst({
      where: {
        email: normalizedEmail,
        code: trimmedCode,
        verified: false,
        expiresAt: {
          gt: new Date(), // Not expired
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!otpRecord) {
      logger.warn(`❌ [EMAIL OTP] Verification failed for ${normalizedEmail}: Invalid or expired OTP`);
      return {
        status: 'failed',
        to: normalizedEmail,
        valid: false,
        message: 'Invalid or expired OTP',
      };
    }

    // Mark OTP as verified
    await prisma.emailOtp.update({
      where: { id: otpRecord.id },
      data: { verified: true },
    });

    logger.info(`✅ [EMAIL OTP] OTP verified successfully for ${normalizedEmail}`);

    return {
      status: 'approved',
      to: normalizedEmail,
      valid: true,
      message: 'OTP verified successfully',
    };
  } catch (error) {
    logger.error(`❌ [EMAIL OTP] Verification error for ${normalizedEmail}: ${error.message}`);
    throw new Error(`Failed to verify email OTP: ${error.message}`);
  }
}

/**
 * Clean up expired Email OTPs
 */
async function cleanupExpiredOtps() {
  try {
    const result = await prisma.emailOtp.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    logger.info(`🧹 [EMAIL OTP] Cleaned up ${result.count} expired email OTP records`);
    return result.count;
  } catch (error) {
    logger.error('❌ [EMAIL OTP] Error cleaning up expired email OTPs:', error.message);
    throw error;
  }
}

module.exports = {
  sendOtp,
  verifyOtp,
  cleanupExpiredOtps,
  generateOtpCode,
};
