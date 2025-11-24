const twilio = require("twilio");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const serviceSid = process.env.TWILIO_SERVICE_SID;

const client = twilio(accountSid, authToken);

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
      const resp = await client.verify.v2.services(serviceSid)
        .verifications.create({
          to: phone,
          channel: "sms",
        });

      console.log("✅ OTP sent to:", phone);
      return resp;
    } catch (error) {
      console.error("❌ OTP sending failed:", error.message);
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

    try {
      const resp = await client.verify.v2.services(serviceSid)
        .verificationChecks.create({
          to: phone,
          code,
        });

      if (resp.status === "approved") {
        console.log("✅ OTP Verified Successfully");
        return { verified: true };
      }

      return { verified: false };
    } catch (error) {
      console.error("❌ OTP verification failed:", error.message);
      throw new Error("Invalid OTP");
    }
  }
}

module.exports = new OtpService();
