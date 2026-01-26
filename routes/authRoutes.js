// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

const attributionMiddleware = require('../middleware/attributionMiddleware');

// Phone OTP routes
router.post('/phone/request-otp', authController.requestPhoneOtp);
router.post('/phone/verify-otp', attributionMiddleware, authController.verifyPhoneOtp);

// Aadhaar OTP routes
router.post('/aadhaar/request-otp', authController.requestAadhaarOtp);
router.post('/aadhaar/verify-otp', authController.verifyAadhaarOtp);

module.exports = router;
