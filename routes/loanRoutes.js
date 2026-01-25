const express = require('express');
const router = express.Router();
const loanController = require('../controllers/loanController');
const { protect } = require('../middleware/authMiddleware');
const attributionMiddleware = require('../middleware/attributionMiddleware');

// Apply attribution middleware to capture ?pid=...&sig=... 
router.post('/apply', protect, attributionMiddleware, loanController.applyForLoan);

module.exports = router;
