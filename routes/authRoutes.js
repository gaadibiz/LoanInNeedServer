// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Phone OTP routes
router.post('/phone/request-otp', authController.requestPhoneOtp);
router.post('/phone/verify-otp', authController.verifyPhoneOtp);

module.exports = router;
