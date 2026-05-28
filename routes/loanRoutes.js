const express = require('express');
const router = express.Router();
const loanController = require('../controllers/loanController');
const { protect } = require('../middleware/authMiddleware');
const attributionMiddleware = require('../middleware/attributionMiddleware');
const { verifyApiKey } = require('../middleware/apiKeyAuth');
const { withConcurrencyLimit } = require('../middleware/concurrencyManager');

// Apply attribution middleware to capture ?pid=...&sig=... 
router.post('/apply', protect, attributionMiddleware, 
    withConcurrencyLimit('SUBMISSION', 10, 'Our servers are processing a high volume of applications. Please try again in 5 seconds.'),
    loanController.applyForLoan
);

// PDF Download (User Auth)
router.get('/:applicationId/pdf', protect, loanController.downloadApplicationPdf);

// Public Endpoints
router.post('/check-eligibility', loanController.checkEligibility);

// Admin / Export Endpoints
router.get('/status', verifyApiKey, loanController.getLoanStatus);

router.get('/export', verifyApiKey, 
    withConcurrencyLimit('EXPORT', 2, 'System is at maximum capacity processing other heavy exports. Please wait a moment and try again.'),
    loanController.exportLoanApplications
);

router.put('/update-status', verifyApiKey, loanController.updateLoanStatusFromLos);

module.exports = router;
