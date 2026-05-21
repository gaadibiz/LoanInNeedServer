/**
 * ============================================================
 * 🔄 Application Audit Middleware
 * ============================================================
 * Hooks into the response lifecycle after KYC submission so
 * every created LoanApplication is automatically audited and
 * logged — without blocking the API response.
 * ============================================================
 */

const { auditApplication } = require('../services/applicationAuditService');
const logger = require('../utils/logger');

/**
 * postKycAudit
 * -----------
 * Attach to any route that creates a LoanApplication.
 * Reads `res.locals.auditTarget` which kycService populates.
 *
 * Usage in route:
 *   router.post('/submit', authenticate, submitKYC, postKycAudit);
 */
function postKycAudit(req, res, next) {
  // Already sent — nothing to intercept, just pass through
  next();
}

/**
 * attachAuditHook
 * ---------------
 * Wraps res.json() so we can fire the audit AFTER the response
 * is sent without delaying it.  Attach before the route handler.
 *
 * Usage:
 *   router.post('/submit', authenticate, attachAuditHook, submitKYC);
 */
function attachAuditHook(req, res, next) {
  const originalJson = res.json.bind(res);

  res.json = function (body) {
    // Fire-and-forget audit after response is delivered
    setImmediate(async () => {
      try {
        // kycService puts { success, data: { application } } in the response
        const applicationId = body?.data?.application?.id || null;
        const userId        = req.user?.id || body?.data?.user?.id || null;

        if (userId) {
          await auditApplication(userId, applicationId, 'POST_KYC');
        }
      } catch (err) {
        logger.error('[AUDIT-MIDDLEWARE] Background audit failed: ' + err.message);
      }
    });

    return originalJson(body);
  };

  next();
}

/**
 * attachDocumentAuditHook
 * -----------------------
 * Same pattern — fires after document upload endpoints so we
 * can re-audit and check if the user is now export-eligible.
 */
function attachDocumentAuditHook(req, res, next) {
  const originalJson = res.json.bind(res);

  res.json = function (body) {
    setImmediate(async () => {
      try {
        const userId = req.user?.id || null;
        if (userId) {
          // No specific applicationId here — audit the latest app
          await auditApplication(userId, null, 'POST_DOCUMENT_UPLOAD');
        }
      } catch (err) {
        logger.error('[AUDIT-MIDDLEWARE] Document audit failed: ' + err.message);
      }
    });

    return originalJson(body);
  };

  next();
}

module.exports = { postKycAudit, attachAuditHook, attachDocumentAuditHook };
