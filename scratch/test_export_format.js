/**
 * Export format test — checks ALL records, finds best one with docs
 */
const https = require('https');

const API_KEY = 'paromita$432';
const HOST = 'lionfish-app-mg3te.ondigitalocean.app';
const FROM = '2026-01-01T00:00:00.000Z';
const TO   = '2026-12-31T23:59:59.000Z';

const options = {
  hostname: HOST, port: 443,
  path: `/api/loans/export?from=${FROM}&to=${TO}`,
  method: 'GET',
  headers: { 'Authorization': `Key ${API_KEY}` }
};

const checkBase64 = (val, label) => {
  if (val === null || val === undefined) return `${label}: null`;
  if (typeof val === 'string') {
    if (val.includes('placeholder.com')) return `${label}: ❌ PLACEHOLDER!`;
    const [name, b64] = val.split(',');
    return b64 && b64.length > 100
      ? `${label}: ✅ base64 "${name}" (${b64.length} chars)`
      : `${label}: ⚠️  "${val.slice(0, 60)}"`;
  }
  return `${label}: (type: ${typeof val})`;
};

const checkArray = (val, label) => {
  if (val === null || val === undefined) return `${label}: null`;
  if (!Array.isArray(val)) return `${label}: ⚠️  type=${typeof val}`;
  if (val.length === 0) return `${label}: [] empty`;
  return `${label}: [${val.length}] ✅`;
};

console.log(`\n🔍 https://${HOST}${options.path}\n`);

https.request(options, (res) => {
  let raw = '';
  res.on('data', c => raw += c);
  res.on('end', () => {
    if (res.statusCode !== 200) { console.error(`❌ HTTP ${res.statusCode}:`, raw); return; }

    const records = JSON.parse(raw).data || [];
    console.log(`✅ ${records.length} records total\n`);

    // Check placeholder.com across ALL records
    const fullJson = JSON.stringify(records);
    console.log(fullJson.includes('placeholder.com')
      ? '❌ placeholder.com FOUND somewhere in response!'
      : '✅ No placeholder.com anywhere in all records');

    // Check bankStatements field exists on all
    const missingBankStmt = records.filter(r => !('bankStatements' in r));
    console.log(missingBankStmt.length === 0
      ? '✅ bankStatements field present in ALL records'
      : `❌ bankStatements MISSING in ${missingBankStmt.length} records`);

    console.log('\n─────────────────────────────────────────');
    console.log('📋 ALL RECORDS SUMMARY');
    console.log('─────────────────────────────────────────');

    records.forEach((r, i) => {
      const hasAadhaar    = r.aadhaarFront !== null;
      const hasPan        = r.panCard !== null;
      const hasPhoto      = r.profilePicture !== null;
      const hasSalary     = Array.isArray(r.salarySlips) && r.salarySlips.length > 0;
      const hasBank       = Array.isArray(r.bankStatements) && r.bankStatements.length > 0;
      const hasAddrDoc    = Array.isArray(r.addressDocument) && r.addressDocument.length > 0;

      const docs = [
        hasAadhaar ? 'Aadhaar✅' : 'Aadhaar❌',
        hasPan     ? 'PAN✅'     : 'PAN❌',
        hasPhoto   ? 'Photo✅'   : 'Photo❌',
        hasSalary  ? 'Salary✅'  : 'Salary❌',
        hasBank    ? 'Bank✅'    : 'Bank❌',
        hasAddrDoc ? 'Addr✅'    : 'Addr❌',
      ].join(' ');

      console.log(`[${i+1}] ${r.id} | ${r.name} → ${docs}`);
    });

    // Deep-dive: pick the record with most documents
    const scored = records.map(r => ({
      r,
      score: [r.aadhaarFront, r.panCard, r.profilePicture].filter(Boolean).length
            + (Array.isArray(r.salarySlips) ? r.salarySlips.length : 0)
            + (Array.isArray(r.bankStatements) ? r.bankStatements.length : 0)
    }));
    const best = scored.sort((a,b) => b.score - a.score)[0].r;

    console.log(`\n─────────────────────────────────────────`);
    console.log(`📄 DEEP-DIVE: ${best.id} (most docs)`);
    console.log(`─────────────────────────────────────────`);
    console.log(checkBase64(best.aadhaarFront,   'aadhaarFront'));
    console.log(checkBase64(best.aadhaarBack,    'aadhaarBack'));
    console.log(checkBase64(best.panCard,        'panCard'));
    console.log(checkBase64(best.profilePicture, 'profilePicture'));
    console.log(checkArray(best.salarySlips,     'salarySlips'));
    console.log(checkArray(best.bankStatements,  'bankStatements'));
    console.log(checkArray(best.addressDocument, 'addressDocument'));

    console.log('\n🔑 KEY FIELDS:');
    console.log(`  id: ${best.id} | name: ${best.name} | panNo: ${best.panNo}`);
    console.log(`  aadhaarNo: ${best.aadhaarNo} | loanAmount: ${best.loanAmount}`);
    console.log(`  status: ${best.status} | stepsCompleted: ${best.stepsCompleted}`);
    console.log('─────────────────────────────────────────\n');
  });
}).on('error', e => console.error('❌', e.message)).end();
