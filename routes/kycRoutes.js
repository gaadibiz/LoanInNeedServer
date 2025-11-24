const express = require('express');
const router = express.Router();
const { submitKYC } = require('../controllers/kycController');
const { authenticateUser, authenticate } = require('../middleware/authMiddleware');

/**
 * @route   POST /api/kyc
 * @desc    Submit full KYC (Employment + Address + Loan)
 * @access  Authenticated users
 */
router.post(
  '/',                 // endpoint: /api/kyc
  authenticate,    // ensures user is logged in
  submitKYC            // handles the full KYC submission
);

module.exports = router;
