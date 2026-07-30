const express = require('express');
const router = express.Router();
const finnauxController = require('../controllers/finnauxController');
const { verifyApiKey } = require('../middleware/apiKeyAuth');

// Manually trigger Finnaux push
router.post('/applications/:applicationId/trigger', verifyApiKey, finnauxController.triggerFinnauxIntegration);

// Fetch raw payloads (request/response) for Finnaux jobs within a date range
router.get('/applications/get-loan-applications', verifyApiKey, finnauxController.getFinnauxRawPayloads);

module.exports = router;
