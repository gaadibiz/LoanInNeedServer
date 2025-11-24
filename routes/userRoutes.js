const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/authMiddleware');

// Registration now requires JWT authentication
router.post('/register', authenticate, userController.registerUser);

// Login (OTP-based)
router.post('/login', userController.loginUser);

// Protected route
router.get('/me', authenticate, userController.getProfile);

// Complete profile with all KYC details
router.get('/profile/complete', authenticate, userController.getCompleteProfile);

// Location routes
router.post('/location', authenticate, userController.submitLocation);
router.get('/location', authenticate, userController.getLocation);

module.exports = router;
