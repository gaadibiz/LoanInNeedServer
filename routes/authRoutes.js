// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

const attributionMiddleware = require('../middleware/attributionMiddleware');
const { protect } = require('../middleware/authMiddleware'); // Added protect
const { withConcurrencyLimit } = require('../middleware/concurrencyManager');

// Phone OTP routes
router.post('/phone/request-otp',
    withConcurrencyLimit('OTP', 25, 'High traffic volume. Please wait 10 seconds before requesting an OTP.'),
    authController.requestPhoneOtp
);
router.post('/phone/verify-otp',
    withConcurrencyLimit('OTP', 25, 'High traffic volume. Please wait 10 seconds before verifying your OTP.'),
    attributionMiddleware,
    authController.verifyPhoneOtp
);

router.post('/register/register-phone-without-verification',
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
    protect,
    authController.saveVerifiedAadhaarDetails
);

// Aadhaar OTP routes
router.post('/aadhaar/request-otp', protect, authController.requestAadhaarOtp);
router.post('/aadhaar/verify-otp', protect, authController.verifyAadhaarOtp);
// Real-time Aadhaar existence check (no DB write, used for inline frontend validation)
router.post('/aadhaar/validate', protect, authController.validateAadhaarExists);

module.exports = router;
