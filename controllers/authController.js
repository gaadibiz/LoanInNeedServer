// controllers/authController.js
const authService = require('../services/authService');
const asyncHandler = require('express-async-handler'); // cleaner try/catch
const surepassService = require('../services/surepassService');
const aadhaarService = require('../services/aadharService');

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

// Verify Aadhaar OTP (Using Surepass Validation endpoint OR master OTP bypass)
const MASTER_OTP = '261102';

const verifyAadhaarOtp = asyncHandler(async (req, res) => {
  const { aadhaarNumber, otp } = req.body;
  const userId = req.user?.id;
  
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  if (!aadhaarNumber) {
    return res.status(400).json({ success: false, message: 'Aadhaar number is required' });
  }

  let aadhaarDetails;

  // Master OTP bypass — skips external Surepass API
  if (otp === MASTER_OTP) {
    console.log(`[AUTH] Master OTP used — bypassing Surepass for user: ${userId}`);
    aadhaarDetails = {
      client_id: 'bypass_master_otp',
      aadhaar_number: aadhaarNumber,
      status: 'valid',
      message: 'Verified via master OTP bypass'
    };
  } else {
    // Use Surepass Validation API for real OTP flow
    aadhaarDetails = await surepassService.verifyAadhaar(aadhaarNumber);
  }

  // Persist Aadhaar Validation in DB
  await aadhaarService.submitAadhaar(userId, aadhaarNumber);
  await aadhaarService.verifyAadhaar(userId);

  console.log(`[AUTH] Aadhaar Verified successfully for user: ${userId}`);
  res.json({ 
    success: true, 
    message: "Aadhaar verified successfully",
    data: aadhaarDetails 
  });
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
