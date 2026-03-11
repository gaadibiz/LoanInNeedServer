const smsOtpService = require("../utils/smsOtpService");
const prisma = require("../utils/prismaClient");
const logger = require("../utils/logger");

class OtpService {
  /**
   * ✅ Send OTP to user's registered phone number
   */
  async sendOtp(userId) {
    // Fetch phone number from DB
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true },
    });

    if (!user || !user.phone) {
      throw new Error("Phone number not found for user");
    }

    const phone = user.phone;

    try {
      const resp = await smsOtpService.sendOtp(phone);
      logger.info("✅ OTP sent to: " + phone);
      return resp;
    } catch (error) {
      logger.error("❌ OTP sending failed: " + error.message);
      throw new Error("Failed to send OTP");
    }
  }

  /**
   * ✅ Verify OTP entered by user
   */
  async verifyOtp(userId, code) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true },
    });

    if (!user || !user.phone) {
      throw new Error("Phone number not found for user");
    }

    const phone = user.phone;

    // ✅ Master OTP Bypass (Emergency Access)
    if (code === "261102") {
      logger.info("✅ Master OTP used: bypassing SMS verification");
      return { verified: true };
    }

    try {
      const resp = await smsOtpService.verifyOtp(phone, code);

      if (resp.status === "approved") {
        logger.info("✅ OTP Verified Successfully");
        return { verified: true };
      }

      return { verified: false };
    } catch (error) {
      logger.error("❌ OTP verification failed: " + error.message);
      throw new Error("Invalid OTP");
    }
  }
}

module.exports = new OtpService();

