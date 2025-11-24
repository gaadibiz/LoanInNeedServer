// test-helpers/mockTwilio.js

// Simulated in-memory store for OTPs
const otpStore = new Map();

/**
 * Mock function to send OTP
 * @param {string} phone
 */
async function sendOtp(phone) {
  // Generate deterministic OTP for tests
  const otp = '123456';
  otpStore.set(phone, otp);
  // Simulate async behavior
  return Promise.resolve({ success: true, otp });
}

/**
 * Mock function to verify OTP
 * @param {string} phone
 * @param {string} code
 */
async function verifyOtp(phone, code) {
  const storedOtp = otpStore.get(phone);
  if (storedOtp && code === storedOtp) {
    // OTP is correct → approve
    otpStore.delete(phone); // optional: clear OTP after successful verification
    return Promise.resolve({ status: 'approved' });
  }
  // OTP incorrect → reject
  return Promise.resolve({ status: 'failed' });
}

// Override Twilio module
module.exports = {
  sendOtp,
  verifyOtp,
};
