// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

const attributionMiddleware = require('../middleware/attributionMiddleware');

// Phone OTP routes
router.post('/phone/request-otp', authController.requestPhoneOtp);
router.post('/phone/verify-otp', attributionMiddleware, authController.verifyPhoneOtp);

module.exports = router;
