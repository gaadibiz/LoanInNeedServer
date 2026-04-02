const express = require('express');
const router = express.Router();
const loanController = require('../controllers/loanController');
const { protect } = require('../middleware/authMiddleware');
const attributionMiddleware = require('../middleware/attributionMiddleware');
const { verifyApiKey } = require('../middleware/apiKeyAuth');

// Apply attribution middleware to capture ?pid=...&sig=... 
router.post('/apply', protect, attributionMiddleware, loanController.applyForLoan);

// PDF Download (User Auth)
router.get('/:applicationId/pdf', protect, loanController.downloadApplicationPdf);

// Admin / Export Endpoints
router.get('/status', verifyApiKey, loanController.getLoanStatus);
router.get('/export', verifyApiKey, loanController.exportLoanApplications);

module.exports = router;
