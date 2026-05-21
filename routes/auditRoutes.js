/**
 * ============================================================
 * 🛣️  Audit Routes  —  /api/audit
 * ============================================================
 */

const express = require('express');
const router  = express.Router();
const { authenticate, admin } = require('../middleware/authMiddleware');
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
router.get('/logs', authenticate, getAuditLogs);

/**
 * GET  /api/audit/not-exported
 * Only applications that failed LOS export — with reasons
 */
router.get('/not-exported', authenticate, getNotExported);

/**
 * POST /api/audit/run/:userId
 * POST /api/audit/run/:userId/:applicationId
 * Trigger a single audit manually (support / admin use)
 */
router.post('/run/:userId', authenticate, runSingleAudit);
router.post('/run/:userId/:applicationId', authenticate, runSingleAudit);

/**
 * POST /api/audit/bulk
 * Re-audit all applications in a date range
 * Body: { startDate, endDate, limit }
 */
router.post('/bulk', authenticate, runBulkAudit);

module.exports = router;
