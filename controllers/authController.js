// controllers/authController.js
const authService = require('../services/authService');
const { evaluateEligibility } = require('../services/loanService');
const asyncHandler = require('express-async-handler'); // cleaner try/catch
const surepassService = require('../services/surepassService');
const aadhaarService = require('../services/aadharService');
const AadhaarModel = require('../models/aadhaarModel');
const { BadRequestError } = require('../GlobalExceptionHandler/exception');
const UserModel = require('../models/userModel');

require('dotenv').config()
// Request OTP
const requestPhoneOtp = asyncHandler(async (req, res) => {
  const { phone } = req.body;
  const result = await authService.requestPhoneOtp(phone);
  res.json(result);
});

// Verify OTP
const verifyPhoneOtp = asyncHandler(async (req, res) => {
  const { phone, code, utmSource, utmMedium, utmCampaign, utmId, utmTerm, utmContent } = req.body;
  // Pass attribution if available (from middleware)
  const attribution = req.attribution || null;
  const utm = { utmSource, utmMedium, utmCampaign, utmId, utmTerm, utmContent };
  console.log('[DEBUG] Auth Controller - Attribution:', attribution); // DEBUG LOG
  const result = await authService.verifyPhoneOtp(phone, code, attribution, utm);
  let {user} = result
  res.json(result);
  (async () => {
    try {
      // Persist UTM attribution params (if the client sent any) for this user
      await saveUtmIfPresent(user.id, utm);
    } catch (error) {
      console.log(error);
    }
    try {
      console.log("[BUMCHUM] Sending Loan Application to Bumchum", user.id);
      if (user) {
        await sendLoanApplicationToBumchum(user.id, '');
      }
    } catch (error) {
      console.log(error, "here is the error");
    }

  })();
});

//Register phone number without verification
const registerPhoneWithoutVerification = asyncHandler(async (req, res) => {
  console.log(req.body, "---->")
  const { phone, utmSource, utmMedium, utmCampaign, utmId, utmTerm, utmContent } = req.body;
  // Pass attribution if available (from middleware)
  const attribution = req.attribution || null;
  const utm = { utmSource, utmMedium, utmCampaign, utmId, utmTerm, utmContent };
  console.log('[DEBUG] Auth Controller - Attribution:', attribution); // DEBUG LOG
  const result = await authService.registerPhone(phone, attribution, utm);

  // Merge in eligibility check (Step 2 payload may already be present in req.body).
  // Registration has already succeeded at this point, so we always respond 200
  // regardless of the eligibility outcome.
  const { statusCode, ...eligibility } = evaluateEligibility(req.body);
  res.json({ ...result, ...eligibility });
});

// Validate Aadhaar existence via Surepass (no DB write — for real-time frontend check)
const validateAadhaarExists = asyncHandler(async (req, res) => {
  const { aadhaarNumber } = req.body;

  if (!aadhaarNumber || aadhaarNumber.replace(/\D/g, '').length !== 12) {
    return res.status(400).json({ success: false, message: 'A valid 12-digit Aadhaar number is required' });
  }

  try {
    const cleanAadhaar = aadhaarNumber.replace(/\D/g, '');

    // Check if Aadhaar is already registered to another user in our DB
    const existing = await AadhaarModel.findByAadhaarNumber(cleanAadhaar);
    if (existing && existing.userId !== req.user?.id) {
      return res.status(409).json({ success: false, message: 'This Aadhaar number is already registered with another account.' });
    }

    await surepassService.verifyAadhaar(cleanAadhaar);
    return res.json({ success: true, message: 'Aadhaar number is valid' });
  } catch (err) {
    return res.status(422).json({ success: false, message: 'Invalid Aadhaar number. Please enter a valid Aadhaar card number.' });
  }
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
  try {
    await aadhaarService.submitAadhaar(userId, aadhaarNumber);
    await aadhaarService.verifyAadhaar(userId);
  } catch (err) {
    if (err.isOperational || err.statusCode === 400) {
      return res.status(err.statusCode || 400).json({ success: false, message: err.message });
    }
    throw err;
  }

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

/**
 * POST /api/auth/aadhaar/request-digilocker
 * Generates a Digilocker consent URL for the logged-in user.
 * ?mock=true (non-prod only) skips Signzy for local/QA testing.
 */
const requestDigiLocker = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  if (!userId) {
    throw new BadRequestError('userId is required');
  }

  const mock = req.query.mock === 'true' && process.env.NODE_ENV !== 'production';

  const digilockerDetails = await aadhaarService.requestDigilockerUrl(userId, { mock });

  res.status(200).json({
    success: true,
    message: 'Digilocker URL generated successfully',
    data: digilockerDetails,
  });
});

/**
 * POST /api/auth/aadhaar/save-verified-adhaar-details
 * Called directly by our own frontend (authenticated, JWT required) once the
 * user lands back on successRedirectUrl/failureRedirectUrl after the
 * Digilocker consent flow. No Signzy webhook involved — this just invokes
 * aadhaarService.handleDigilockerCallback as a plain function for the
 * logged-in user.
 */
const saveVerifiedAadhaarDetails = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  console.log("RAW_USER_ID--------", userId)
  if (!userId) {
    throw new BadRequestError('userId is required');
  }

  const result = await aadhaarService.handleDigilockerCallback(userId, req.body.status);

  res.status(200).json({
    success: true,
    message: result.saved ? 'Aadhaar details saved successfully' : 'Callback received',
    data: result.data
  });
});


module.exports =
{
  requestPhoneOtp,
  verifyPhoneOtp,
  verifyAadhaarOtp,
  requestAadhaarOtp,
  validateAadhaarExists,
  saveVerifiedAadhaarDetails,
  requestDigiLocker,
  registerPhoneWithoutVerification
};
