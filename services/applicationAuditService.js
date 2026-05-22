/**
 * ============================================================
 * 🔍 Application Audit Service
 * ============================================================
 * Runs between every loan application flow to:
 *  1. CLASSIFY  — Complete vs Incomplete, Fresh Loan vs Reloan
 *  2. VALIDATE  — Checks every field required for LOS export
 *  3. LOG       — Structured JSON entry per application in
 *                 logs/audit/ with customer name + reasons
 *  4. RETURN    — Full audit report for API consumption
 * ============================================================
 */

const prisma  = require('../utils/prismaClient');
const logger  = require('../utils/logger');
const path    = require('path');
const fs      = require('fs');

// ── Dedicated audit log directory ──────────────────────────
const AUDIT_LOG_DIR  = path.join(__dirname, '..', 'logs', 'audit');
const AUDIT_LOG_FILE = path.join(AUDIT_LOG_DIR, 'application-audit.log');

if (!fs.existsSync(AUDIT_LOG_DIR)) {
  fs.mkdirSync(AUDIT_LOG_DIR, { recursive: true });
}

// ── In-memory audit store (last 500 records for fast API reads) ──
const AUDIT_STORE    = [];
const AUDIT_MAX      = 500;

function appendToStore(record) {
  AUDIT_STORE.unshift(record);
  if (AUDIT_STORE.length > AUDIT_MAX) AUDIT_STORE.pop();
}

// ── Write one JSON line to the audit log file ─────────────
function writeAuditLog(record) {
  try {
    fs.appendFileSync(AUDIT_LOG_FILE, JSON.stringify(record) + '\n', 'utf8');
  } catch (err) {
    logger.error('[AUDIT] Failed to write audit log: ' + err.message);
  }
}

// ── Read audit log file into array ────────────────────────
function readAuditLog() {
  try {
    if (!fs.existsSync(AUDIT_LOG_FILE)) return [];
    const lines = fs.readFileSync(AUDIT_LOG_FILE, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map(l => {
        try { return JSON.parse(l); } catch { return null; }
      })
      .filter(Boolean);
    // Return newest first
    return lines.reverse();
  } catch (err) {
    logger.error('[AUDIT] Failed to read audit log: ' + err.message);
    return [];
  }
}

// ============================================================
// CLASSIFIER — determines user type and loan type
// ============================================================
function classifyApplication(user, totalApplicationsForUser) {
  const panVerified   = user.panVerification?.verified  === true;
  const aadVerified   = user.aadhaarVerification?.verified === true;
  const isProfileComplete = panVerified && aadVerified;

  // A reloan is any application after the first one
  const isReloan = totalApplicationsForUser > 1;

  let category;
  if (isProfileComplete && isReloan)      category = 'COMPLETE_RELOAN';
  else if (isProfileComplete && !isReloan) category = 'COMPLETE_FRESH_LOAN';
  else if (!isProfileComplete && isReloan) category = 'INCOMPLETE_RELOAN';
  else                                     category = 'INCOMPLETE_FRESH_LOAN';

  return {
    isProfileComplete,
    isReloan,
    category,
    panVerified,
    aadhaarVerified: aadVerified,
    totalApplications: totalApplicationsForUser,
  };
}

// ============================================================
// VALIDATOR — mirrors the exact logic in exportLoanApplications
// ============================================================
function validateForExport(user, classification) {
  const issues   = [];   // ❌ Hard blockers — will NOT be exported
  const warnings = [];   // ⚠️  Soft gaps — exported but data missing

  const correctness = {
    panFormat: { status: 'N/A', value: null, message: 'Not evaluated' },
    aadhaarFormat: { status: 'N/A', value: null, message: 'Not evaluated' },
    mobileFormat: { status: 'N/A', value: null, message: 'Not evaluated' },
    postalCodeFormat: { status: 'N/A', value: null, message: 'Not evaluated' },
    placeholderDetection: { status: 'PASS', value: null, message: 'Clean' }
  };

  // ── 1. Name ───────────────────────────────────────────────
  if (!user.name) {
    issues.push('Customer name is missing entirely');
  } else {
    const nameParts = user.name.trim().split(/\s+/).filter(Boolean);
    if (nameParts.length < 2) {
      issues.push(`Name "${user.name}" has only one word — full name (first + last) is required`);
    }
  }

  // ── 2. PAN ────────────────────────────────────────────────
  if (!user.panVerification?.panNumber) {
    issues.push('PAN number is not recorded');
    correctness.panFormat = { status: 'FAIL', value: null, message: 'PAN number is missing' };
  } else {
    const pan = user.panVerification.panNumber;
    correctness.panFormat.value = pan;
    const isMasked = /^\*+[A-Z0-9]+$/i.test(pan);
    const isStandard = /^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(pan);
    if (!classification.panVerified) {
      issues.push('PAN number exists but is NOT verified — cannot be exported');
    }
    if (isStandard || isMasked) {
      correctness.panFormat.status = 'PASS';
      correctness.panFormat.message = isMasked ? 'Valid masked PAN' : 'Valid PAN format';
    } else {
      correctness.panFormat.status = 'FAIL';
      correctness.panFormat.message = 'Invalid PAN format detected';
    }
  }

  // ── 3. Aadhaar ────────────────────────────────────────────
  if (!user.aadhaarVerification?.aadhaarNumber) {
    issues.push('Aadhaar number is not recorded');
    correctness.aadhaarFormat = { status: 'FAIL', value: null, message: 'Aadhaar number is missing' };
  } else {
    const originalAadhaar = user.aadhaarVerification.aadhaarNumber;
    correctness.aadhaarFormat.value = originalAadhaar;
    const isDuplicate = originalAadhaar.includes('_DUP_');
    const cleanAadhaar = originalAadhaar.split('_DUP_')[0];
    
    if (isDuplicate) {
      issues.push('Duplicate Aadhaar record detected (_DUP_ suffix)');
      correctness.aadhaarFormat.status = 'FAIL';
      correctness.aadhaarFormat.message = 'Duplicate Aadhaar detected';
    } else if (!/^[2-9]{1}[0-9]{11}$/.test(cleanAadhaar)) {
      correctness.aadhaarFormat.status = 'FAIL';
      correctness.aadhaarFormat.message = 'Invalid Aadhaar format';
    } else {
      correctness.aadhaarFormat.status = 'PASS';
      correctness.aadhaarFormat.message = 'Valid Aadhaar format';
    }
    
    if (!classification.aadhaarVerified) {
      issues.push('Aadhaar number exists but is NOT verified — cannot be exported');
    }
  }

  // ── 3.1. Mobile Format ─────────────────────────────────────
  if (!user.phone) {
    correctness.mobileFormat = { status: 'FAIL', value: null, message: 'Mobile number is missing' };
  } else {
    correctness.mobileFormat.value = user.phone;
    if (/^[6-9][0-9]{9}$/.test(user.phone)) {
      correctness.mobileFormat.status = 'PASS';
      correctness.mobileFormat.message = 'Valid mobile format';
    } else {
      correctness.mobileFormat.status = 'FAIL';
      correctness.mobileFormat.message = 'Invalid mobile format';
    }
  }

  // ── 4. Documents ──────────────────────────────────────────
  const docTypes = (user.documents || []).map(d => d.docType);

  if (classification.isProfileComplete) {
    // Complete profile: only bank statement mandatory
    if (!docTypes.includes('BANK_STATEMENT')) {
      issues.push('Bank statement is missing (mandatory for all users, including complete profiles)');
    }
    // Soft warnings for missing optional docs
    if (!docTypes.includes('PAY_SLIP'))   warnings.push('Salary slip not uploaded (optional for complete profile)');
    if (!docTypes.includes('PAN'))        warnings.push('PAN document image not uploaded (optional for complete profile)');
    if (!docTypes.includes('AADHAAR'))    warnings.push('Aadhaar document image not uploaded (optional for complete profile)');
  } else {
    // Incomplete profile: all 4 are mandatory
    if (!docTypes.includes('BANK_STATEMENT')) issues.push('Bank statement is missing');
    if (!docTypes.includes('PAY_SLIP'))       issues.push('Salary slip is missing');
    if (!docTypes.includes('PAN'))            issues.push('PAN document image is missing');
    if (!docTypes.includes('AADHAAR'))        issues.push('Aadhaar document image is missing');
  }

  // ── 5. Address & Pincode ──────────────────────────────────
  const addr = user.address;
  const placeholders = [];
  
  if (!addr) {
    warnings.push('No address record found — address fields will be blank in export');
  } else {
    if (!addr.currentAddress) warnings.push('Current address not filled');
    if (!addr.city)           warnings.push('City not captured');
    if (!addr.postalCode)     warnings.push('Pin code is missing');
    if (!addr.state)          warnings.push('State is missing');
    
    // Pincode validation
    correctness.postalCodeFormat.value = addr.postalCode || null;
    if (addr.postalCode && /^[1-9][0-9]{5}$/.test(addr.postalCode)) {
      correctness.postalCodeFormat.status = 'PASS';
      correctness.postalCodeFormat.message = 'Valid pin code';
    } else if (addr.postalCode) {
      correctness.postalCodeFormat.status = 'FAIL';
      correctness.postalCodeFormat.message = 'Invalid pin code format';
    }

    // Placeholder detection
    const checkPlaceholder = (val, field) => {
      if (typeof val === 'string') {
        const lower = val.toLowerCase().trim();
        if (['delhi', '000000', 'undefined', 'n/a', 'none', '-', 'null'].includes(lower)) {
          placeholders.push(`${field}: ${val}`);
        }
      }
    };
    checkPlaceholder(addr.city, 'City');
    checkPlaceholder(addr.postalCode, 'Pincode');
    checkPlaceholder(addr.currentAddress, 'Address');
  }

  if (placeholders.length > 0) {
    correctness.placeholderDetection.status = 'FAIL';
    correctness.placeholderDetection.message = `Placeholders detected: ${placeholders.join(', ')}`;
    warnings.push(`Address fields contain generic placeholders: ${placeholders.join(', ')}`);
  }

  // ── 6. Employment ─────────────────────────────────────────
  if (!user.employment) {
    warnings.push('No employment record — income and company fields will be blank in export');
  }

  // ── 7. Photo / Selfie ─────────────────────────────────────
  if (!docTypes.includes('PHOTO')) {
    warnings.push('Profile selfie not uploaded');
  }

  const exportEligible = issues.length === 0;
  return { exportEligible, issues, warnings, correctness };
}

// ============================================================
// MAIN AUDIT FUNCTION — call this after every loan application
// ============================================================
async function auditApplication(userId, applicationId, triggeredBy = 'SYSTEM') {
  try {
    // ── Fetch full user data ───────────────────────────────
    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
      include: {
        address:              true,
        employment:           true,
        documents:            true,
        aadhaarVerification:  true,
        panVerification:      true,
        loanApplications:     { orderBy: { createdAt: 'asc' } },
      }
    });

    if (!user) {
      logger.warn(`[AUDIT] userId=${userId} not found — skipping audit`);
      return null;
    }

    // ── Count applications for this user ──────────────────
    const totalApps = user.loanApplications?.length || 1;

    // ── Classify ──────────────────────────────────────────
    const classification = classifyApplication(user, totalApps);

    // ── Validate ──────────────────────────────────────────
    const validation = validateForExport(user, classification);

    // ── Build report ──────────────────────────────────────
    const report = {
      auditedAt:       new Date().toISOString(),
      triggeredBy,
      userId:          user.id,
      customerId:      user.customUserId || null,
      applicationId:   applicationId || null,
      customerName:    user.name       || 'UNKNOWN',
      phone:           user.phone      || null,
      email:           user.email      || null,

      // Classification
      category:        classification.category,
      isProfileComplete: classification.isProfileComplete,
      isReloan:        classification.isReloan,
      totalApplications: classification.totalApplications,
      panVerified:     classification.panVerified,
      aadhaarVerified: classification.aadhaarVerified,

      // Export Eligibility
      exportEligible:  validation.exportEligible,
      issues:          validation.issues,
      warnings:        validation.warnings,
      correctness:     validation.correctness,
    };

    // ── Log to file ───────────────────────────────────────
    writeAuditLog(report);
    appendToStore(report);

    // ── Log to Winston ────────────────────────────────────
    if (validation.exportEligible) {
      logger.info(
        `[APP-AUDIT] ✅ EXPORT ELIGIBLE | Customer: ${report.customerName} | Category: ${report.category} | AppId: ${applicationId}`,
        { service: 'ApplicationAudit', userId, applicationId }
      );
    } else {
      logger.warn(
        `[APP-AUDIT] ❌ NOT EXPORTED | Customer: ${report.customerName} | Category: ${report.category} | AppId: ${applicationId}\n` +
        `  REASONS: ${validation.issues.map((i, n) => `\n    ${n + 1}. ${i}`).join('')}`,
        { service: 'ApplicationAudit', userId, applicationId, issues: validation.issues }
      );
    }

    return report;

  } catch (err) {
    logger.error(`[AUDIT] auditApplication failed for userId=${userId}: ${err.message}`);
    return null;
  }
}

// ============================================================
// BULK AUDIT — re-audit all applications in a date range
// ============================================================
async function auditAllApplications({ startDate, endDate, limit = 200 } = {}) {
  const where = {};
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate)   where.createdAt.lte = new Date(endDate);
  }

  const applications = await prisma.loanApplication.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true, userId: true }
  });

  logger.info(`[AUDIT-BULK] Starting bulk audit of ${applications.length} applications`);

  const results = [];
  for (const app of applications) {
    const report = await auditApplication(app.userId, app.id, 'BULK_AUDIT');
    if (report) results.push(report);
  }

  const eligible   = results.filter(r => r.exportEligible).length;
  const ineligible = results.length - eligible;

  logger.info(`[AUDIT-BULK] Done. Eligible: ${eligible} | Not Exported: ${ineligible} / ${results.length}`);

  return {
    summary: { total: results.length, exportEligible: eligible, notExported: ineligible },
    results
  };
}

// ============================================================
// GET AUDIT LOGS — for the admin API
// ============================================================
async function getAuditLogs({ page = 1, limit = 50, exportEligible, category, search } = {}) {
  let logs = readAuditLog();

  // ── Filters ───────────────────────────────────────────────
  if (exportEligible !== undefined) {
    const eligible = exportEligible === 'true' || exportEligible === true;
    logs = logs.filter(l => l.exportEligible === eligible);
  }
  if (category) {
    logs = logs.filter(l => l.category === category);
  }
  if (search) {
    const q = search.toLowerCase();
    logs = logs.filter(l =>
      (l.customerName || '').toLowerCase().includes(q) ||
      (l.phone || '').includes(q) ||
      (l.customerId || '').toLowerCase().includes(q)
    );
  }

  // ── Pagination ────────────────────────────────────────────
  const total  = logs.length;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const paged  = logs.slice(offset, offset + parseInt(limit));

  // ── Fetch dynamic LOS Integration Jobs ─────────────────────
  const appIds = paged.map(l => l.applicationId).filter(Boolean);
  if (appIds.length > 0) {
    try {
      const jobs = await prisma.losIntegrationJob.findMany({
        where: { applicationId: { in: appIds } }
      });
      const jobMap = {};
      jobs.forEach(j => jobMap[j.applicationId] = j);

      paged.forEach(l => {
        if (l.applicationId && jobMap[l.applicationId]) {
          const j = jobMap[l.applicationId];
          l.losJob = {
            status: j.status,
            retryCount: j.retryCount || 0,
            losCaseNumber: j.losCaseNumber || null,
            lastError: j.lastError || null
          };
        } else {
          l.losJob = { status: 'NONE', retryCount: 0, losCaseNumber: null, lastError: null };
        }
      });
    } catch (err) {
      logger.error('[AUDIT] Failed to fetch dynamic LOS jobs: ' + err.message);
    }
  }

  // ── Summary counts ────────────────────────────────────────
  const allLogs = readAuditLog();
  const summary = {
    total:               allLogs.length,
    exportEligible:      allLogs.filter(l => l.exportEligible).length,
    notExported:         allLogs.filter(l => !l.exportEligible).length,
    byCategory: {
      COMPLETE_FRESH_LOAN:    allLogs.filter(l => l.category === 'COMPLETE_FRESH_LOAN').length,
      COMPLETE_RELOAN:        allLogs.filter(l => l.category === 'COMPLETE_RELOAN').length,
      INCOMPLETE_FRESH_LOAN:  allLogs.filter(l => l.category === 'INCOMPLETE_FRESH_LOAN').length,
      INCOMPLETE_RELOAN:      allLogs.filter(l => l.category === 'INCOMPLETE_RELOAN').length,
    }
  };

  return { summary, total, page: parseInt(page), limit: parseInt(limit), logs: paged };
}

// ============================================================
// GET EXPORT LOGS — analytics for LOS export API calls
// ============================================================
async function getExportLogs({ page = 1, limit = 50 } = {}) {
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const total = await prisma.losExportLog.count();
  
  const logs = await prisma.losExportLog.findMany({
    skip,
    take: parseInt(limit),
    orderBy: { calledAt: 'desc' }
  });

  return {
    success: true,
    total,
    page: parseInt(page),
    limit: parseInt(limit),
    logs
  };
}

module.exports = {
  auditApplication,
  auditAllApplications,
  getAuditLogs,
  getExportLogs,
  classifyApplication,
  validateForExport,
};
