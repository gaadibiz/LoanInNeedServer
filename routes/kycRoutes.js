const express = require('express');
const router = express.Router();
const kycController = require('../controllers/kycController');
const { protect } = require('../middleware/authMiddleware');
const { attachAuditHook } = require('../middleware/auditMiddleware');
const multer = require('multer');

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Submit KYC details — audit middleware fires AFTER response (non-blocking)
router.post('/', protect, attachAuditHook, kycController.submitKYC);

// Get KYC details
router.get('/', protect, kycController.getKYC);

// PAN Verification with image upload
router.post('/verify-pan', protect, upload.single('panImage'), kycController.verifyPAN);

// Granular Updates (PUT)
router.put('/employment', protect, kycController.updateEmployment);
router.put('/address', protect, kycController.updateAddress);


module.exports = router;
