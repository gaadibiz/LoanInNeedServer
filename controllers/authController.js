// controllers/authController.js
const authService = require('../services/authService');
const asyncHandler = require('express-async-handler'); // cleaner try/catch

// Request OTP
const requestPhoneOtp = asyncHandler(async (req, res) => {
  const { phone } = req.body;
  const result = await authService.requestPhoneOtp(phone);
  res.json(result);
});

// Verify OTP
const verifyPhoneOtp = asyncHandler(async (req, res) => {
  const { phone, code } = req.body;
  // Pass attribution if available (from middleware)
  const attribution = req.attribution || null;
  console.log('[DEBUG] Auth Controller - Attribution:', attribution); // DEBUG LOG
  const result = await authService.verifyPhoneOtp(phone, code, attribution);
  res.json(result);
});

// Verify Aadhaar OTP (Bypass)
const verifyAadhaarOtp = asyncHandler(async (req, res) => {
  const { otp } = req.body;
  // Bypass logic: Accept any OTP or specifically Master OTP
  // Since we disabled sending, we just return success
  console.log('[AUTH] Aadhaar OTP Verified (Bypass)');
  res.json({ success: true, message: "Aadhaar verified successfully" });
});

// Request Aadhaar OTP (Stub/Bypass)
const requestAadhaarOtp = asyncHandler(async (req, res) => {
  // We do nothing, just return success so frontend proceeds
  res.json({ success: true, message: "OTP sent successfully" });
});

module.exports =
{
  requestPhoneOtp,
  verifyPhoneOtp,
  verifyAadhaarOtp,
  requestAadhaarOtp
};
