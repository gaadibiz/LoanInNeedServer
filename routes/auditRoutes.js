/**
 * ============================================================
 * 🛣️  Audit Routes  —  /api/audit
 * ============================================================
 */

const express = require('express');
const router  = express.Router();
const { verifyApiKey } = require('../middleware/apiKeyAuth');
const {
  getAuditLogs,
  runSingleAudit,
  runBulkAudit,
  getNotExported,
} = require('../controllers/auditController');

/**
 * GET  /api/audit/logs
 * All audit logs with pagination + filters
 */
router.get('/logs', verifyApiKey, getAuditLogs);

/**
 * GET  /api/audit/not-exported
 * Only applications that failed LOS export — with reasons
 */
router.get('/not-exported', verifyApiKey, getNotExported);

/**
 * POST /api/audit/run/:userId
 * POST /api/audit/run/:userId/:applicationId
 * Trigger a single audit manually (support / admin use)
 */
router.post('/run/:userId', verifyApiKey, runSingleAudit);
router.post('/run/:userId/:applicationId', verifyApiKey, runSingleAudit);

/**
 * POST /api/audit/bulk
 * Re-audit all applications in a date range
 * Body: { startDate, endDate, limit }
 */
router.post('/bulk', verifyApiKey, runBulkAudit);

module.exports = router;
