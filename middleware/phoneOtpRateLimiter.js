// middleware/phoneOtpRateLimiter.js
const prisma = require('../utils/prismaClient');
const logger = require('../utils/logger');

const OTP_COOLDOWN_SECONDS = parseInt(process.env.OTP_COOLDOWN_SECONDS || '60', 10);
const OTP_HOURLY_LIMIT = parseInt(process.env.OTP_HOURLY_LIMIT || '5', 10);

/**
 * Middleware to enforce per-phone-number rate limits:
 * 1. Cooldown window (default 60s) to prevent rapid-fire requests.
 * 2. Hourly quota (default 5 OTPs / hour) to prevent OTP bombing / toll fraud.
 */
const phoneOtpRateLimiter = async (req, res, next) => {
  // Allow bypassing in tests unless explicitly testing rate limiter
  if (process.env.NODE_ENV === 'test' && !req.headers['x-enforce-phone-limiter']) {
    return next();
  }

  const phone = req.body?.phone;
  if (!phone || typeof phone !== 'string') {
    return next(); // Let controller handle missing/invalid phone formats
  }

  const cleanPhone = phone.trim();

  try {
    // 1. Check cooldown (e.g. 60 seconds)
    const cooldownDate = new Date(Date.now() - OTP_COOLDOWN_SECONDS * 1000);
    const recentOtp = await prisma.otp.findFirst({
      where: {
        phone: cleanPhone,
        createdAt: {
          gte: cooldownDate,
        },
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    if (recentOtp) {
      const elapsedSeconds = Math.floor((Date.now() - new Date(recentOtp.createdAt).getTime()) / 1000);
      const remainingSeconds = Math.max(1, OTP_COOLDOWN_SECONDS - elapsedSeconds);
      logger.warn(`[OTP RATE LIMIT] Cooldown blocked for phone ${cleanPhone} (${remainingSeconds}s remaining) | IP: ${req.ip}`);
      return res.status(429).json({
        success: false,
        message: `Please wait ${remainingSeconds} seconds before requesting another OTP.`,
      });
    }

    // 2. Check hourly limit (e.g. 5 OTPs per hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const hourlyCount = await prisma.otp.count({
      where: {
        phone: cleanPhone,
        createdAt: {
          gte: oneHourAgo,
        },
      },
    });

    if (hourlyCount >= OTP_HOURLY_LIMIT) {
      logger.warn(`[OTP RATE LIMIT] Hourly quota exceeded for phone ${cleanPhone} (${hourlyCount}/${OTP_HOURLY_LIMIT}) | IP: ${req.ip}`);
      return res.status(429).json({
        success: false,
        message: 'Too many OTP requests for this phone number. Please try again after 1 hour.',
      });
    }

    next();
  } catch (err) {
    logger.error(`[OTP RATE LIMIT ERROR] Error checking rate limit for ${cleanPhone}:`, err);
    // On unexpected DB error, do not block the user flow entirely
    next();
  }
};

module.exports = {
  phoneOtpRateLimiter,
  OTP_COOLDOWN_SECONDS,
  OTP_HOURLY_LIMIT,
};
