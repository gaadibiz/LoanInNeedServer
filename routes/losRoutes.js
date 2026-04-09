const express = require('express');
const router = express.Router();
const losController = require('../controllers/losController');
const { verifyApiKey } = require('../middleware/apiKeyAuth');

// Define API routes for LOS system
// It's highly recommended to add an authentication middleware (e.g., an API key or Admin check) here.
router.get('/applications', verifyApiKey, losController.getApplicationsForLos);

// An endpoint for LOS to update the status of the job
router.put('/applications/:applicationId/status', verifyApiKey, losController.updateJobStatus);

// Manually trigger LOS push 
router.post('/applications/:applicationId/trigger', verifyApiKey, losController.triggerLosIntegration);

module.exports = router;
