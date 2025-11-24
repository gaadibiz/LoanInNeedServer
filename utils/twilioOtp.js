const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const serviceSid = process.env.TWILIO_SERVICE_SID;

const client = twilio(accountSid, authToken); // ✅ Correct constructor call

// Send OTP
const sendOtp = async (phone) => {
  try {
    const verification = await client.verify.v2.services(serviceSid)
      .verifications.create({
        to: phone,
        channel: 'sms',
      });
    return verification;
  } catch (error) {
    console.error(`Twilio sendOtp error for ${phone}:`, error.message);
    throw error;
  }
};

// Verify OTP
const verifyOtp = async (phone, code) => {
  try {
    const verificationCheck = await client.verify.v2.services(serviceSid)
      .verificationChecks.create({
        to: phone,
        code,
      });
    return verificationCheck;
  } catch (error) {
    console.error(`Twilio verifyOtp error for ${phone}:`, error.message);
    throw error;
  }
};

module.exports = { sendOtp, verifyOtp };
