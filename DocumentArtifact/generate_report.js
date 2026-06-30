const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const doc = new PDFDocument({
  size: 'A4',
  margins: { top: 60, bottom: 60, left: 60, right: 60 },
  info: {
    Title: 'LoanInNeed Server — Complete Bug & Issue Report',
    Author: 'LoanInNeed QA Team',
    Subject: 'Security & Bug Report',
    CreationDate: new Date('2026-06-17'),
  },
});

const outputPath = path.join(__dirname, 'report.pdf');
const stream = fs.createWriteStream(outputPath);
doc.pipe(stream);

// ── Colours ────────────────────────────────────────────────────────────────
const C = {
  navy:      '#1B2A4A',
  red:       '#C0392B',
  orange:    '#D35400',
  amber:     '#B7770D',
  green:     '#1E7145',
  slate:     '#5D6D7E',
  lightGray: '#F4F6F8',
  midGray:   '#BDC3C7',
  darkGray:  '#2C3E50',
  white:     '#FFFFFF',
  accent:    '#2E86C1',
};

const PAGE_W = doc.page.width  - 120; // usable width
const LEFT   = 60;

// ── Helpers ────────────────────────────────────────────────────────────────
function pageHeader() {
  doc.rect(0, 0, doc.page.width, 40)
     .fill(C.navy);
  doc.fontSize(9).fillColor(C.white)
     .text('LoanInNeed Server — Bug & Issue Report  |  CONFIDENTIAL', LEFT, 14, { align: 'left', lineBreak: false });
  doc.text('2026-06-17', LEFT, 14, { align: 'right', width: PAGE_W, lineBreak: false });
  doc.y = 55;
}

function pageFooter(pageNum) {
  const y = doc.page.height - 45;
  doc.rect(0, y, doc.page.width, 45).fill(C.lightGray);
  doc.moveTo(0, y).lineTo(doc.page.width, y).strokeColor(C.midGray).lineWidth(0.5).stroke();
  doc.fontSize(8).fillColor(C.slate)
     .text('© 2026 LoanInNeed — Internal Use Only', LEFT, y + 14, { align: 'left', lineBreak: false });
  doc.text(`Page ${pageNum}`, LEFT, y + 14, { align: 'right', width: PAGE_W, lineBreak: false });
}

let _pageNum = 1;
doc.on('pageAdded', () => {
  _pageNum++;
  pageHeader();
});

function sectionTitle(text, color = C.navy) {
  ensureSpace(60);
  doc.moveDown(0.6);
  const blockY = doc.y;
  doc.rect(LEFT, blockY, PAGE_W, 26).fill(color);
  doc.fontSize(12).fillColor(C.white).font('Helvetica-Bold')
     .text(text, LEFT + 10, blockY + 5, { width: PAGE_W - 20, lineBreak: false });
  doc.y = blockY + 30;
  doc.moveDown(0.3);
  doc.fillColor(C.darkGray).font('Helvetica');
}

function subSection(text) {
  ensureSpace(40);
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor(C.navy).font('Helvetica-Bold').text(text, LEFT);
  doc.moveTo(LEFT, doc.y + 2).lineTo(LEFT + PAGE_W, doc.y + 2)
     .strokeColor(C.accent).lineWidth(1).stroke();
  doc.moveDown(0.4);
  doc.fillColor(C.darkGray).font('Helvetica');
}

function bugBlock(id, title, severity, file, testCases) {
  ensureSpace(80);
  const severityColors = {
    CRITICAL: C.red,
    HIGH:     C.orange,
    MEDIUM:   C.amber,
    LOW:      C.slate,
  };
  const sColor = severityColors[severity] || C.slate;

  doc.moveDown(0.6);
  // Bug header bar
  const blockY = doc.y;
  doc.rect(LEFT, blockY, PAGE_W, 22).fill(sColor);
  doc.fontSize(10).fillColor(C.white).font('Helvetica-Bold')
     .text(`${id}  ·  ${title}`, LEFT + 8, blockY + 4, { width: PAGE_W - 100, lineBreak: false });
  const sevLabel = `[${severity}]`;
  doc.text(sevLabel, LEFT, blockY + 4, { align: 'right', width: PAGE_W - 8, lineBreak: false });
  doc.y = blockY + 22;
  doc.moveDown(0.2);

  // Meta row
  doc.fontSize(8.5).fillColor(C.slate).font('Helvetica');
  if (file)      doc.text(`File: ${file}`, LEFT + 8);
  if (testCases) doc.text(`Test Cases: ${testCases}`, LEFT + 8);
  doc.moveDown(0.3);
  doc.fillColor(C.darkGray).fontSize(9.5).font('Helvetica');
}

function bodyText(text) {
  doc.fontSize(9.5).fillColor(C.darkGray).font('Helvetica').text(text, LEFT, doc.y, {
    width: PAGE_W,
    align: 'justify',
    lineGap: 2,
  });
  doc.moveDown(0.2);
}

function labelText(label, value) {
  doc.fontSize(9.5).font('Helvetica-Bold').fillColor(C.navy).text(label + ' ', LEFT + 8, doc.y, { continued: true });
  doc.font('Helvetica').fillColor(C.darkGray).text(value, { width: PAGE_W - 8 });
}

function codeBlock(code) {
  ensureSpace(30);
  doc.moveDown(0.2);
  const lines = code.split('\n');
  const blockH = lines.length * 13 + 10;
  const blockY = doc.y;
  doc.rect(LEFT, blockY, PAGE_W, blockH).fill('#EAF0FB');
  doc.moveTo(LEFT, blockY).lineTo(LEFT, blockY + blockH).strokeColor(C.accent).lineWidth(2).stroke();
  doc.fontSize(8.5).fillColor('#1A5276').font('Courier')
     .text(code.trim(), LEFT + 10, blockY + 5, { width: PAGE_W - 20, lineGap: 1 });
  doc.y = blockY + blockH + 4;
  doc.moveDown(0.4);
  doc.font('Helvetica').fillColor(C.darkGray);
}

function bullet(items) {
  items.forEach(item => {
    doc.fontSize(9.5).fillColor(C.darkGray).font('Helvetica')
       .text(`•  ${item}`, LEFT + 10, doc.y, { width: PAGE_W - 10, lineGap: 1 });
  });
  doc.moveDown(0.2);
}

function divider() {
  doc.moveDown(0.3);
  doc.moveTo(LEFT, doc.y).lineTo(LEFT + PAGE_W, doc.y)
     .strokeColor(C.midGray).lineWidth(0.5).stroke();
  doc.moveDown(0.3);
}

function ensureSpace(needed) {
  if (doc.y + needed > doc.page.height - 80) {
    doc.addPage();
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// COVER PAGE
// ══════════════════════════════════════════════════════════════════════════════
doc.rect(0, 0, doc.page.width, doc.page.height).fill(C.navy);

// Logo band
doc.rect(0, 0, doc.page.width, 8).fill(C.accent);
doc.rect(0, doc.page.height - 8, doc.page.width, 8).fill(C.accent);

// Central card
const cardY = 140, cardH = 360;
doc.rect(50, cardY, doc.page.width - 100, cardH).fill(C.white);

doc.fontSize(28).fillColor(C.navy).font('Helvetica-Bold')
   .text('LoanInNeed Server', 0, cardY + 30, { align: 'center' });
doc.fontSize(16).fillColor(C.accent).font('Helvetica')
   .text('Complete Bug & Issue Report', 0, cardY + 68, { align: 'center' });

// Divider line in card
doc.moveTo(120, cardY + 100).lineTo(doc.page.width - 120, cardY + 100)
   .strokeColor(C.midGray).lineWidth(1).stroke();

// Stats row
const stats = [
  { label: 'Total Tests', value: '81' },
  { label: 'Pass', value: '45' },
  { label: 'Fail', value: '25' },
  { label: 'Warn', value: '11' },
];
const statX = 80, statW = (doc.page.width - 160) / 4;
stats.forEach((s, i) => {
  const x = statX + i * statW;
  doc.fontSize(26).fillColor(i === 2 ? C.red : i === 3 ? C.amber : C.navy)
     .font('Helvetica-Bold').text(s.value, x, cardY + 120, { width: statW, align: 'center' });
  doc.fontSize(9).fillColor(C.slate).font('Helvetica')
     .text(s.label, x, cardY + 155, { width: statW, align: 'center' });
});

// Meta grid
const meta = [
  ['Project',   'LoanInNeed Server (LoanInNeedServer)'],
  ['Branch',    'testDeploy'],
  ['Server',    'http://localhost:5000'],
  ['Date',      '2026-06-17'],
  ['Scope',     'OTP Auth APIs · KYC APIs · UI Issues · Track Loan'],
];
let mY = cardY + 190;
meta.forEach(([k, v]) => {
  doc.fontSize(9).fillColor(C.slate).font('Helvetica-Bold')
     .text(k + ':', 80, mY, { width: 80 });
  doc.fontSize(9).fillColor(C.darkGray).font('Helvetica')
     .text(v, 170, mY, { width: doc.page.width - 250 });
  mY += 18;
});

// Confidential
doc.fontSize(8).fillColor(C.midGray).font('Helvetica')
   .text('CONFIDENTIAL — INTERNAL USE ONLY', 0, doc.page.height - 60, { align: 'center', lineBreak: false });

// ══════════════════════════════════════════════════════════════════════════════
// PAGE 2: TABLE OF CONTENTS
// ══════════════════════════════════════════════════════════════════════════════
doc.addPage();

doc.fontSize(18).fillColor(C.navy).font('Helvetica-Bold')
   .text('Table of Contents', LEFT, 70);
doc.moveTo(LEFT, 95).lineTo(LEFT + PAGE_W, 95)
   .strokeColor(C.accent).lineWidth(1.5).stroke();
doc.moveDown(1);

const toc = [
  ['1', 'Executive Summary', C.red, '3'],
  ['2', 'OTP Authentication API Bugs', C.navy, '4'],
  ['2.1', 'Critical Bugs — OTP APIs', C.red, '4'],
  ['2.2', 'High Severity Bugs — OTP APIs', C.orange, '5'],
  ['2.3', 'Medium & Low Severity — OTP APIs', C.amber, '6'],
  ['3', 'KYC API Bugs', C.navy, '7'],
  ['3.2', 'High Severity Bugs — KYC APIs', C.orange, '7'],
  ['3.3', 'Medium Severity Bugs — KYC APIs', C.amber, '9'],
  ['3.4', 'Low Severity / Code Quality — KYC APIs', C.slate, '11'],
  ['4', 'UI Issues', C.navy, '12'],
  ['5', 'Track Loan Issues', C.navy, '13'],
];

toc.forEach(([num, title, color, pg]) => {
  const isMain = num.length === 1;
  const indent = isMain ? LEFT : LEFT + 20;
  doc.fontSize(isMain ? 10.5 : 9.5)
     .fillColor(color).font(isMain ? 'Helvetica-Bold' : 'Helvetica')
     .text(num + '.  ' + title, indent, doc.y, { continued: true, width: PAGE_W - 40 });
  doc.fillColor(C.slate).font('Helvetica')
     .text(pg, { align: 'right' });
  if (isMain) doc.moveDown(0.3);
});

pageFooter(1);

// ══════════════════════════════════════════════════════════════════════════════
// PAGE 3+: CONTENT
// ══════════════════════════════════════════════════════════════════════════════
doc.addPage();
doc.y = 55;

// ── SECTION 1: EXECUTIVE SUMMARY ─────────────────────────────────────────────
sectionTitle('SECTION 1  —  EXECUTIVE SUMMARY', C.navy);

bodyText(
  'The OTP authentication and KYC APIs are partially functional but contain serious security ' +
  'vulnerabilities that MUST be resolved before going to production.'
);

doc.moveDown(0.3);
doc.fontSize(10).fillColor(C.navy).font('Helvetica-Bold').text('Key Concerns:', LEFT);
doc.moveDown(0.2);

bullet([
  'A hardcoded master bypass code ("261102") exists directly in the source code. Anyone who finds this code can log in as ANY phone number — no real SMS verification is needed. This is a critical authentication bypass.',
  'A malicious script tag submitted in the loan "purpose" field is stored directly in the database and sent back in API responses — this is a stored XSS attack vector.',
  'The Aadhaar OTP verification is a complete stub — it accepts ANY input, including an empty body, and returns "Aadhaar verified successfully." There is zero actual identity verification happening.',
  'No rate limiting is in place anywhere — an attacker can fire thousands of OTP requests or verification attempts with no throttling or lockout.',
]);

doc.moveDown(0.3);
bodyText(
  'These issues collectively represent significant security risks, data integrity problems, and poor user experience. ' +
  'None of the critical issues require major architectural changes — they are targeted fixes in specific service files.'
);

divider();

// ── SECTION 2 ────────────────────────────────────────────────────────────────
sectionTitle('SECTION 2  —  OTP AUTHENTICATION API BUGS', C.navy);

doc.fontSize(9.5).fillColor(C.slate).font('Helvetica')
   .text('Endpoints Covered:', LEFT);
bullet([
  'POST /api/auth/phone/request-otp',
  'POST /api/auth/phone/verify-otp',
  'POST /api/auth/aadhaar/request-otp',
  'POST /api/auth/aadhaar/verify-otp',
]);

// 2.1 Critical
subSection('2.1  Critical Bugs — OTP APIs');

bugBlock('OTP-C1', 'Hardcoded Master Bypass OTP Code', 'CRITICAL',
  'services/authService.js  ~line 48', 'T13, T18, T24, T35');


bodyText(
  'The code contains a hardcoded secret OTP value ("261102"). When any user sends this specific code ' +
  'in the verify-otp request, the server skips all OTP verification and immediately creates or logs in ' +
  'the user. There is no check on whether the user actually received an SMS OTP.'
);


bullet([
  'Any developer, tester, or attacker who discovers this code (from code review, version history, or trial-and-error) can log into ANY phone number account without owning the phone.',
  'Since there is no phone number validation when this bypass is used (see OTP-C2), an attacker can create accounts with garbage phone numbers like "\' OR 1=1 --" stored in the database.',
  'The bypass code can be used unlimited times for any phone number (replay attack confirmed).',
]);


bodyText(
  'Remove the hardcoded bypass entirely. If developers need a testing bypass, create a DEV_OTP_BYPASS_CODE ' +
  'environment variable that is explicitly removed in production deployment. Never hardcode credentials in source code.'
);

divider();

bugBlock('OTP-C2', 'No Phone Number Sanitisation Before Database Write', 'CRITICAL',
  'services/authService.js  lines 62–88', 'T18, T24');


bodyText(
  'When the master bypass OTP is used, the phone number field is never validated. The server accepts and ' +
  'stores ANY string as the user\'s phone number in the User table.'
);


bullet([
  'Phone: "\' OR 1=1 --"  →  User created, JWT token returned (200 OK)',
  'Phone: "+91   "  →  User created with whitespace phone, JWT returned (200 OK)',
]);


bodyText('Validate phone against the international E.164 standard format before ANY database operation:');
codeBlock('/^\\+[1-9]\\d{7,14}$/');

divider();

// 2.2 High
subSection('2.2  High Severity Bugs — OTP APIs');

bugBlock('OTP-H1', 'No Rate Limiting on OTP Request Endpoint', 'HIGH',
  'services/authService.js  lines 12–33', 'T31');


bodyText(
  'There is no limit on how many OTP requests can be sent for a phone number or from an IP address. ' +
  'All 5 rapid-fire requests in the test returned 200 OK with no throttling.'
);


bullet([
  'An attacker can spam OTP requests to flood the SMS provider (Speqtra API), incurring significant cost.',
  'Legitimate users can be harassed by unwanted OTP SMS messages.',
  'Brute-force OTP guessing is possible when combined with unlimited retries.',
]);


bodyText('Install the express-rate-limit npm package and configure:');
codeBlock(
  '// OTP Request — max 3 per phone per 10 minutes\n' +
  '// OTP Verify — max 5 attempts per phone per 10 minutes, then lock'
);

divider();

// 2.3 Medium
subSection('2.3  Medium & Low Severity — OTP APIs');

bugBlock('OTP-M1', 'Integer OTP Code Type Causes 500 Error', 'MEDIUM',
  'controllers/authController.js  line 13', 'T22');

bodyText('When the OTP code is sent as a number (261102) instead of a string ("261102"), the server returns HTTP 500. The code attempts string operations on an integer.');


codeBlock('const code = String(req.body.code ?? \'\')');

divider();

bugBlock('OTP-M2', 'Aadhaar OTP Is a Complete Bypass — Accepts Anything', 'MEDIUM',
  'controllers/authController.js  lines 22–35', 'T27, T28, T29');

bodyText(
  'Both Aadhaar OTP endpoints are stubs returning "success" regardless of any input. An empty body {} ' +
  'on verify-otp returns "Aadhaar verified successfully." This stub must never be exposed in production.'
);


codeBlock(
  "if (process.env.AADHAAR_STUB_ENABLED !== 'true') {\n" +
  "  return res.status(503).json({ message: 'Aadhaar verification unavailable' });\n" +
  "}"
);

divider();

bugBlock('OTP-L2', 'Console.log Debug Statements in Production Code', 'LOW',
  'controllers/authController.js line 17, middleware/attributionMiddleware.js line 16', '');

bodyText(
  'Debug log statements like "[DEBUG] Auth Controller - Attribution:" are present in production code. ' +
  'These print sensitive attribution data to server logs. Remove all console.log() calls or replace with ' +
  'logger.debug() which can be silenced by setting the log level in production.'
);

divider();

bugBlock('OTP-L4', 'JWT Token Contains Personal Data (Phone and Email)', 'LOW',
  'utils/jwt.js', '');

bodyText('The JWT token payload includes the user\'s phone number and email address. JWT token bodies are base64-encoded (not encrypted) — anyone can decode the token body without the secret key and read the personal data.');

codeBlock('{ "id": 12705, "email": null, "phone": "+919900000001", "role": "CUSTOMER" }');


bodyText('Remove PII from the JWT payload. Store only { id, customUserId, role }. Return only the customUserId (e.g. "LIN12705") — not the raw integer primary key, which reveals database row counts.');

divider();

// ── SECTION 3 ────────────────────────────────────────────────────────────────
sectionTitle('SECTION 3  —  KYC API BUGS', C.navy);

doc.fontSize(9.5).fillColor(C.slate).font('Helvetica').text('Endpoints Covered:', LEFT);
bullet([
  'GET  /api/kyc',
  'POST /api/kyc  (Full KYC Submission)',
  'POST /api/kyc/verify-pan',
  'PUT  /api/kyc/employment',
  'PUT  /api/kyc/address',
]);

subSection('3.2  High Severity Bugs — KYC APIs');

bugBlock('KYC-H2', 'File Size Error Returns 500 + Multer Stack Trace', 'HIGH',
  'routes/kycRoutes.js, middleware/ErrorHandler.js', 'K38');

bodyText(
  'When a PAN card image larger than 10 MB is uploaded, the server returns HTTP 500 with the full ' +
  'Multer library stack trace including internal file paths and node_modules layout.'
);
labelText('Correct behavior:', 'HTTP 400 with message "File too large. Maximum 10 MB allowed."');

codeBlock(
  "if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {\n" +
  "  return res.status(400).json({ message: 'File too large. Maximum 10 MB.' })\n" +
  "}"
);

divider();

bugBlock('KYC-H3', 'XSS Characters in PAN Number Cause Server Connection Reset / Crash', 'HIGH',
  'controllers/kycController.js  verifyPAN() function', 'K37');

bodyText(
  'When a script tag is submitted as the panNumber via multipart form, the server drops the connection ' +
  'entirely with no HTTP response (curl exit code 26 — connection reset). This indicates a server crash ' +
  'or unhandled exception during multipart parsing or the panNumber.toUpperCase() call.'
);

bullet([
  'A single malformed request can crash or hang the server.',
  'This is a denial-of-service vulnerability.',
]);

bodyText('Validate the panNumber format immediately after reading from req.body:');
codeBlock('/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i\n// Return 400 immediately if format does not match');

divider();

bugBlock('KYC-H4', 'Each POST /api/kyc Creates a New Loan Application (No Idempotency)', 'HIGH',
  'services/kycService.js  saveFullKYC() function', 'K18');

bodyText(
  'Every time the same user calls POST /api/kyc (even with identical data), a brand new LoanApplication ' +
  'record is created. Confirmed: User submitted twice → Application ID 1906 on first call, Application ID ' +
  '1907 on second call.'
);

bullet([
  'A user with a slow connection who retries will have multiple pending loan applications in the system.',
  'Loan officers will see duplicate applications without knowing which is correct.',
  'Downstream LOS integration jobs are created for each duplicate, causing processing errors.',
]);

codeBlock(
  "existing = findFirst({ where: { userId, status: 'PENDING' } })\n" +
  "if (existing) → return existing record instead of creating a new one"
);

divider();

bugBlock('KYC-H5', 'Surepass API Token Hardcoded in Source Code', 'HIGH',
  'services/surepassService.js  constructor', 'K30');

bodyText(
  'The Surepass API authentication JWT token is hardcoded as a fallback value in the source code. ' +
  'If the environment variable SUREPASS_TOKEN is not set, the code uses the hardcoded token.'
);

bullet([
  'The hardcoded token is visible in version control (git history).',
  'Anyone with repository access can extract the token and make unauthorized PAN verification API calls.',
  'The token has a 90-day expiry — this is an active, live credential.',
]);

codeBlock(
  "if (!process.env.SUREPASS_TOKEN) { process.exit(1) }\n" +
  "// Rotate the currently exposed token immediately."
);

divider();

// 3.3 Medium
subSection('3.3  Medium Severity Bugs — KYC APIs');

bugBlock('KYC-M1', 'Silent DB Fallback Masks Missing Required Fields', 'MEDIUM',
  'services/kycService.js  saveFullKYC(), isPlaceholder() merge logic', 'K06, K07');

bodyText(
  'If a user already has an employment record in the database and submits POST /api/kyc without required ' +
  'fields like companyName or monthlyIncome, the server silently uses the old database values and returns ' +
  'HTTP 200 OK. A caller who sends an incomplete form gets no error or warning.'
);
labelText('Note:', 'This behavior only affects users who already have existing employment records. Fresh users correctly get a 400 error.');

bodyText('Log a warning when a fallback to DB values occurs. Alternatively, require all employment fields on initial full KYC submission and only allow partial updates via the dedicated PUT /api/kyc/employment endpoint.');

divider();

bugBlock('KYC-M2', 'No Maximum Loan Amount Validation', 'MEDIUM',
  'services/kycService.js  loanPayload section', 'K17');

bodyText('Any arbitrarily large loan amount is accepted and stored. Test confirmed that loanAmount = 999999999999 (1 trillion) was accepted with HTTP 200.');

bullet([
  'Downstream EMI/interest calculations may overflow or produce incorrect values.',
  'No business rules are enforced — loan applications for impossible amounts will reach loan officers.',
]);

codeBlock("if (loanAmount > 500000) return 400 'Loan amount exceeds maximum limit of ₹5,00,000'");

divider();

bugBlock('KYC-M3', 'Invalid Address Type Silently Stored as Null', 'MEDIUM',
  'controllers/kycController.js  updateAddress()', 'K28');

bodyText(
  'When an invalid currentAddressType value (e.g. "INVALID_TYPE") is submitted, the server stores null ' +
  'in the database and returns HTTP 200 OK. The caller has no idea their address type was discarded.'
);

bodyText('Validate currentAddressType against the known allowed values: RENTED, OWNER_SELF_OR_FAMILY.');

divider();

bugBlock('KYC-M4', 'All 500 Error Responses Expose Stack Traces in Production', 'MEDIUM',
  'middleware/ErrorHandler.js  (global error handler)', 'K15, K19, K23, K38');

bodyText(
  'Every unhandled error returns a response containing error.stack (full JavaScript stack trace with file ' +
  'paths and line numbers) and error.code (internal error codes).'
);

bullet([
  'Stack traces reveal internal file structure and paths.',
  'Library names and versions are exposed (attackers can look up known vulnerabilities).',
  'Database ORM query structure is revealed.',
]);

codeBlock(
  "if (process.env.NODE_ENV !== 'production') { include stack }\n" +
  'else { return { "status": "error", "message": "Something went wrong" } }'
);

divider();

// 3.4 Low
subSection('3.4  Low Severity / Code Quality — KYC APIs');

bugBlock('KYC-L1', 'GET /api/kyc Stub Returns HTTP 200 (Should Return 501)', 'LOW',
  'controllers/kycController.js  getKYC()', 'K01');

bodyText('The GET /api/kyc endpoint is a stub that returns "KYC details not implemented yet." with HTTP 200, implying the request succeeded. An unimplemented endpoint should return HTTP 501 Not Implemented.');
labelText('Fix:', 'res.status(501).json({ message: \'Not implemented yet\' })');

divider();

bugBlock('KYC-L3', 'Unprofessional Error Message on PAN Validation Failure', 'LOW',
  'services/surepassService.js  verifyPAN()', 'K34');

bodyText('When an invalid PAN format is submitted, the error message returned is: "oops Invalid Pan number" — inappropriate for a financial application.');
labelText('Fix:', 'Change to "Invalid PAN number. Please verify and resubmit."');

divider();

bugBlock('KYC-L4', 'No PAN Format Pre-Validation Before External API Call', 'LOW',
  'controllers/kycController.js  submitKYC()', '');

bodyText('Arbitrary strings are sent directly to the Surepass external PAN verification API without first checking if the format is valid. This wastes external API calls and quota on obviously invalid inputs.');
labelText('Fix:', '');
codeBlock('/^[A-Z]{5}[0-9]{4}[A-Z]$/i  — validate before calling external API, return 400 for non-matching formats');

divider();

// ── SECTION 4: UI ISSUES ─────────────────────────────────────────────────────
sectionTitle('SECTION 4  —  UI ISSUES', C.navy);

bodyText('These are front-end issues identified during manual testing:');

subSection('UI-1  ·  Salary Field Allows Scroll / Arrow Key Increment-Decrement');
labelText('Location:', 'Employment section — Monthly Salary / Income input field');
bodyText(
  'The salary input field accepts scrolling with the mouse wheel and clicking the up/down arrow buttons ' +
  'to increment or decrement the value. Users can accidentally change the salary amount by scrolling over the field.'
);
labelText('Fix:', '');
bullet([
  'Add onWheel={(e) => e.target.blur()} to prevent scroll changes.',
  'Remove spinner arrows with CSS: input[type=number] { -moz-appearance: textfield }',
  'input[type=number]::-webkit-inner-spin-button { display: none }',
]);

divider();

subSection('UI-2  ·  PAN Card Surname Field Cannot Be Filled When PAN Has Only First Name');
labelText('Location:', 'PAN verification page — Surname / Last Name input field');
bodyText(
  'When a user submits a PAN card that has only a first name and no surname (common on some Indian PAN cards), ' +
  'the surname field remains empty AND the input field appears to be disabled or locked. The user cannot type ' +
  'in the surname, and the form cannot be submitted.'
);
labelText('Impact:', 'Users with single-name PAN cards are completely unable to complete KYC verification.');
labelText('Fix:', 'If the surname field is empty after PAN verification, enable the surname input so the user can manually type their surname. Do not disable the field just because the API returned no surname.');

divider();

subSection('UI-3  ·  Re-Verification Does Not Update Missing Data from New PAN');
labelText('Location:', 'PAN verification flow — surname/name field after PAN change');
bodyText(
  'When a user who previously verified a PAN with a surname now changes to a different PAN that has NO surname, ' +
  'the old surname from the previous verification is still shown. The system does not clear the surname.'
);
labelText('Impact:', 'User\'s profile shows an incorrect surname that does not belong to their current PAN card.');
labelText('Fix:', 'When re-verification succeeds with a new PAN, fully replace ALL previously stored PAN details. If the new result has no surname, the stored surname should be cleared/emptied.');

divider();

// ── SECTION 5: TRACK LOAN ─────────────────────────────────────────────────────
sectionTitle('SECTION 5  —  TRACK LOAN ISSUES', C.navy);

bodyText('These bugs were identified in the Track Loan feature:');

subSection('TL-1  ·  Any Phone Number Returns the Logged-In User\'s Loan Details');
bodyText(
  'When tracking a loan, entering ANY phone number (including an incorrect or completely unrelated phone number) ' +
  'returns the currently logged-in user\'s own loan details. No error is shown to indicate the phone is wrong.'
);
labelText('Impact:', 'This is a serious data privacy issue — users can attempt to look up other users and keep seeing their own data.');
labelText('Fix:', 'The lookup must search by the submitted phone number and return 404 Not Found if no matching loan exists. It must NOT fall back to the current user\'s data.');

divider();

subSection('TL-3  ·  Address Not Fetched from Aadhaar or PAN Card');
bodyText(
  'The Track Loan / user profile does not auto-populate the user\'s address from their Aadhaar or PAN card ' +
  'verification data. Users must manually enter address details that should already be available from verified documents.'
);
labelText('Fix:', 'After successful PAN/Aadhaar verification, extract the address from the verification response and pre-fill the address fields.');

divider();

subSection('TL-4  ·  Current Address Type Dropdown Is Missing');
bodyText('The "Current Address Type" dropdown (Rented / Owned) is missing from the Track Loan or address section of the application. Users cannot select their address type.');
labelText('Fix:', 'Add the Current Address Type dropdown with options: Rented, Owned by Self or Family.');

divider();

subSection('TL-5  ·  Net Banking Details Link Not Working');
bodyText('The link or button for "Net Banking Details" in the loan application flow is not functional. Clicking it does nothing or leads to an error.');
labelText('Fix:', 'Implement the Net Banking Details flow or connect the existing link to the correct screen/service.');

divider();

subSection('TL-6  ·  Loan History "Reapply" Button Not Working');
bodyText('In the Loan History section, the "Reapply" option/button does not work. Users who want to reapply for a loan after a previous application cannot do so through this button.');
labelText('Fix:', 'Connect the Reapply button to the loan application flow, pre-filling relevant user data where possible.');

// ── Finalize all page footers ─────────────────────────────────────────────────
// Add footer to current (last) page
pageFooter(_pageNum);

doc.end();

stream.on('finish', () => {
  console.log('✅  report.pdf generated successfully at:', outputPath);
});
stream.on('error', err => {
  console.error('❌  Error generating PDF:', err);
  process.exit(1);
});
