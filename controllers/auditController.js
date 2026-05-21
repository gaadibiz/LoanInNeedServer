/**
 * ============================================================
 * 🛠️  Audit Controller
 * ============================================================
 * Admin endpoints to read audit logs, trigger bulk re-audits,
 * and query individual application audit status.
 * ============================================================
 */

const {
  auditApplication,
  auditAllApplications,
  getAuditLogs,
} = require('../services/applicationAuditService');

const logger = require('../utils/logger');

/**
 * GET /api/audit/logs
 * --------------------
 * Returns paginated audit logs with filters.
 *
 * Query params:
 *   page          - page number (default 1)
 *   limit         - records per page (default 50)
 *   exportEligible - "true" | "false"
 *   category      - COMPLETE_FRESH_LOAN | COMPLETE_RELOAN |
 *                   INCOMPLETE_FRESH_LOAN | INCOMPLETE_RELOAN
 *   search        - customer name / phone / customerId substring
 */
exports.getAuditLogs = async (req, res) => {
  try {
    const { page, limit, exportEligible, category, search } = req.query;
    const result = await getAuditLogs({ page, limit, exportEligible, category, search });
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    logger.error('[AUDIT-CTRL] getAuditLogs: ' + err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/audit/run/:userId/:applicationId?
 * --------------------------------------------
 * Manually triggers an audit for a single user/application.
 * Useful for support team to diagnose why a specific customer
 * was not exported.
 */
exports.runSingleAudit = async (req, res) => {
  try {
    const { userId, applicationId } = req.params;
    if (!userId) return res.status(400).json({ success: false, message: 'userId is required' });

    const report = await auditApplication(
      parseInt(userId),
      applicationId ? parseInt(applicationId) : null,
      'MANUAL_ADMIN'
    );

    if (!report) {
      return res.status(404).json({ success: false, message: 'User not found or audit failed' });
    }

    return res.status(200).json({ success: true, report });
  } catch (err) {
    logger.error('[AUDIT-CTRL] runSingleAudit: ' + err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/audit/bulk
 * ---------------------
 * Re-audits all applications in a date range.
 * Body: { startDate, endDate, limit }
 */
exports.runBulkAudit = async (req, res) => {
  try {
    const { startDate, endDate, limit } = req.body;
    const result = await auditAllApplications({ startDate, endDate, limit });
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    logger.error('[AUDIT-CTRL] runBulkAudit: ' + err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/audit/not-exported
 * ----------------------------
 * Shortcut — returns only applications that failed export,
 * sorted by customer name, with the blocking reasons.
 */
exports.getNotExported = async (req, res) => {
  try {
    const { search, category, page, limit } = req.query;
    const result = getAuditLogs({
      page,
      limit,
      exportEligible: false,
      category,
      search
    });
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    logger.error('[AUDIT-CTRL] getNotExported: ' + err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};
