// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

const attributionMiddleware = require('../middleware/attributionMiddleware');
const { protect } = require('../middleware/authMiddleware');
const { verifyApiKey } = require('../middleware/apiKeyAuth');
const { withConcurrencyLimit } = require('../middleware/concurrencyManager');
const { botProtection } = require('../middleware/botProtection');
const { phoneOtpRateLimiter } = require('../middleware/phoneOtpRateLimiter');

// Phone OTP routes
router.post('/phone/request-otp',
    botProtection,
    phoneOtpRateLimiter,
    withConcurrencyLimit('OTP', 25, 'High traffic volume. Please wait 10 seconds before requesting an OTP.'),
    authController.requestPhoneOtp
);
router.post('/phone/verify-otp',
    botProtection,
    withConcurrencyLimit('OTP', 25, 'High traffic volume. Please wait 10 seconds before verifying your OTP.'),
    attributionMiddleware,
    authController.verifyPhoneOtp
);

// Email OTP routes
router.post('/email/request-otp',
    botProtection,
    withConcurrencyLimit('OTP', 25, 'High traffic volume. Please wait 10 seconds before requesting an OTP.'),
    protect,
    authController.requestEmailOtp
);
router.post('/email/verify-otp',
    botProtection,
    withConcurrencyLimit('OTP', 25, 'High traffic volume. Please wait 10 seconds before verifying your OTP.'),
    protect,
    authController.verifyEmailOtp
);

router.post('/register/register-phone-without-verification',
    withConcurrencyLimit('OTP', 25, 'High traffic volume. Please wait 10 seconds.'),
    //verifyApiKey,
    authController.registerPhoneWithoutVerification
);

// User-initiated: generate a Digilocker consent URL (userId comes from the request body)
router.post('/aadhaar/request-digilocker',
    protect,
    authController.requestDigiLocker
);

// Called by our frontend (authenticated) after the user lands back from the
// Digilocker consent flow — fetches and saves the e-Aadhaar for req.user.id
router.post('/aadhaar/save-verified-adhaar-details',
    authController.saveVerifiedAadhaarDetails
);

// Aadhaar OTP routes
router.post('/aadhaar/request-otp', protect, botProtection, authController.requestAadhaarOtp);
router.post('/aadhaar/verify-otp', protect, botProtection, authController.verifyAadhaarOtp);
// Real-time Aadhaar existence check (no DB write, used for inline frontend validation)
router.post('/aadhaar/validate', protect, authController.validateAadhaarExists);
router.post('/verify', verifyApiKey, authController.verify)

module.exports = router;
