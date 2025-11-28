const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const serviceSid = process.env.TWILIO_SERVICE_SID;

// Lazy initialization of Twilio client
let client = null;

const getTwilioClient = () => {
  if (!client) {
    if (!accountSid || !authToken) {
      throw new Error(
        'Twilio credentials are not configured. Please set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables.'
      );
    }
    client = twilio(accountSid, authToken);
  }
  return client;
};

// Send OTP
const sendOtp = async (phone) => {
  try {
    if (!serviceSid) {
      throw new Error('TWILIO_SERVICE_SID environment variable is not set');
    }
    
    const twilioClient = getTwilioClient();
    const verification = await twilioClient.verify.v2.services(serviceSid)
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
    if (!serviceSid) {
      throw new Error('TWILIO_SERVICE_SID environment variable is not set');
    }
    
    const twilioClient = getTwilioClient();
    const verificationCheck = await twilioClient.verify.v2.services(serviceSid)
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
