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

module.exports =
{
  requestPhoneOtp,
  verifyPhoneOtp
};
