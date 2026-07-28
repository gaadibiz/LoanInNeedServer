const express = require('express');
const router = express.Router();
const finnauxController = require('../controllers/finnauxController');
const { verifyApiKey } = require('../middleware/apiKeyAuth');

// Manually trigger Finnaux push
router.post('/applications/:applicationId/trigger', verifyApiKey, finnauxController.triggerFinnauxIntegration);

module.exports = router;
