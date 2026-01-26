const express = require('express');
const router = express.Router();
const kycController = require('../controllers/kycController');
const { protect } = require('../middleware/authMiddleware');
const multer = require('multer');

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Submit KYC details
router.post('/', protect, kycController.submitKYC);

// Get KYC details
router.get('/', protect, kycController.getKYC);

// PAN Verification with image upload
router.post('/verify-pan', protect, upload.single('panImage'), kycController.verifyPAN);

module.exports = router;
