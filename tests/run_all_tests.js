const { execSync } = require('child_process');
const fs = require('fs');

console.log('==================================================');
console.log('🚀 MASTER TEST SUITE EXECUTION STARTING 🚀');
console.log('==================================================\n');

const finalReportLines = [
    '# Final Executed Test Report',
    '\n## Execution Summary',
    `- **Date**: ${new Date().toISOString()}`,
    `- **Target Environment**: UAT (be.loaninneed.in)\n`
];

function runCommand(command, name) {
    console.log(`\n▶️ Running ${name}...`);
    try {
        const output = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
        console.log(`✅ ${name} completed successfully.`);
        return { success: true, output };
    } catch (e) {
        console.error(`❌ ${name} failed.`);
        return { success: false, output: e.stdout || e.message };
    }
}

// 1. Run Jest Tests
finalReportLines.push('## 1. Functional & Database Tests (Jest)');
const jestRes = runCommand('npx jest __tests__/integration/functional.test.js __tests__/integration/database.test.js', 'Jest Functional/DB Tests');
if (jestRes.success) {
    finalReportLines.push('**Status**: ✅ PASSED');
} else {
    finalReportLines.push('**Status**: ❌ FAILED/PARTIAL');
}
finalReportLines.push('```\n' + jestRes.output.substring(0, 1000) + '\n...\n```\n');

// 2. Run Artillery Load Test
finalReportLines.push('## 2. Load Testing (Artillery)');
const loadRes = runCommand('npx artillery run --output tests/artillery_load_report.json tests/artillery/load_test.yml && npx artillery report tests/artillery_load_report.json', 'Artillery Load Test & HTML Generation');
finalReportLines.push('**Status**: ' + (loadRes.success ? '✅ COMPLETED' : '❌ FAILED'));
// Parse some basic metrics if available
finalReportLines.push('```\n' + loadRes.output.substring(Math.max(0, loadRes.output.length - 1000)) + '\n```\n');

// 3. Run Artillery Stress Test
finalReportLines.push('## 3. Stress Testing (Artillery)');
const stressRes = runCommand('npx artillery run tests/artillery/stress_test.yml', 'Artillery Stress Test');
finalReportLines.push('**Status**: ' + (stressRes.success ? '✅ COMPLETED' : '❌ FAILED'));
finalReportLines.push('```\n' + stressRes.output.substring(Math.max(0, stressRes.output.length - 1000)) + '\n```\n');

// 4. Run Artillery Concurrency Test
finalReportLines.push('## 4. Concurrency Testing (Artillery)');
const concRes = runCommand('npx artillery run tests/artillery/concurrency_test.yml', 'Artillery Concurrency Test');
finalReportLines.push('**Status**: ' + (concRes.success ? '✅ COMPLETED' : '❌ FAILED'));
finalReportLines.push('```\n' + concRes.output.substring(Math.max(0, concRes.output.length - 1000)) + '\n```\n');

// 5. Run Infra Mocks
finalReportLines.push('## 5. Infrastructure & Scalability (Simulated)');
const infraRes = runCommand('node tests/simulated_infra_test.js', 'Infra Mocks');
finalReportLines.push('**Status**: ' + (infraRes.success ? '✅ COMPLETED' : '❌ FAILED'));
try {
    const infraJson = JSON.parse(fs.readFileSync('infra_report.json', 'utf8'));
    infraJson.forEach(res => {
        finalReportLines.push(`- **${res.test}**: ${res.status}`);
    });
} catch(e) {}
finalReportLines.push('\n');

// Write out final markdown
fs.writeFileSync('tests/final_test_report_executed.md', finalReportLines.join('\n'));
console.log('\n==================================================');
console.log('✅ ALL TESTS COMPLETED. Generated: tests/final_test_report_executed.md');
console.log('==================================================');
