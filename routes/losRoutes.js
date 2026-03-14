const express = require('express');
const router = express.Router();
const losController = require('../controllers/losController');

// Define API routes for LOS system
// It's highly recommended to add an authentication middleware (e.g., an API key or Admin check) here.
router.get('/applications', losController.getApplicationsForLos);

// An endpoint for LOS to update the status of the job
router.put('/applications/:applicationId/status', losController.updateJobStatus);

module.exports = router;
