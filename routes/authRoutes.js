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

// Aadhaar OTP routes
router.post('/aadhaar/request-otp', protect, authController.requestAadhaarOtp);
router.post('/aadhaar/verify-otp', protect, authController.verifyAadhaarOtp);

module.exports = router;
