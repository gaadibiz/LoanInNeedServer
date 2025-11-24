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
  const result = await authService.verifyPhoneOtp(phone, code);
  res.json(result);
});

module.exports = 
{ requestPhoneOtp, 
  verifyPhoneOtp };
