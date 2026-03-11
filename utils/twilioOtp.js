const twilio = require('twilio');
const logger = require('./logger');

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
    // DEVELOPMENT BYPASS: Skip Twilio and allow any number with code 261102
    const ENABLE_DEV_BYPASS = process.env.ENABLE_DEV_OTP_BYPASS !== 'false'; // Enabled by default

    if (ENABLE_DEV_BYPASS) {
      logger.info(`🔓 [DEV BYPASS] OTP bypass enabled for ${phone}. Use code: 261102`);
      return {
        status: 'pending',
        to: phone,
        channel: 'sms',
        devBypass: true,
        message: 'Development bypass - use code 261102'
      };
    }

    // Production: Use Twilio
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
    logger.error(`Twilio sendOtp error for ${phone}:`, error.message);
    throw error;
  }
};

// Verify OTP
const verifyOtp = async (phone, code) => {
  try {
    // DEVELOPMENT BYPASS: Accept code 261102 for any phone number
    const ENABLE_DEV_BYPASS = process.env.ENABLE_DEV_OTP_BYPASS !== 'false'; // Enabled by default
    const DEV_BYPASS_CODE = '261102';

    if (ENABLE_DEV_BYPASS && code === DEV_BYPASS_CODE) {
      logger.info(`✅ [DEV BYPASS] OTP verified for ${phone} with bypass code`);
      return {
        status: 'approved',
        to: phone,
        valid: true,
        devBypass: true,
        message: 'Development bypass code accepted'
      };
    }

    // Production: Use Twilio
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
    logger.error(`Twilio verifyOtp error for ${phone}:`, error.message);
    throw error;
  }
};

module.exports = { sendOtp, verifyOtp };
