// utils/aadhaarOtp.js

/**
 * Generates a simulated Aadhaar OTP.
 * In production, this function can be replaced by actual service integration.
 */
function generateOtp() {
  // For simulation, using a fixed OTP; replace with random for real-world use
  return '123456';
}

/**
 * Calculates the expiration time for the OTP.
 * @param {number} minutes Number of minutes after which OTP expires.
 * @returns {Date} Expiration timestamp.
 */
function getOtpExpiry(minutes = 5) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

/**
 * Validates the format of Aadhaar numbers.
 * @param {string} aadhaarNumber Aadhaar number to validate.
 * @returns {boolean} True if valid, false otherwise.
 */
function validateAadhaarNumber(aadhaarNumber) {
  const aadhaarRegex = /^\d{4}\s?\d{4}\s?\d{4}$/;
  return aadhaarRegex.test(aadhaarNumber);
}

module.exports = {
  generateOtp,
  getOtpExpiry,
  validateAadhaarNumber
};
0