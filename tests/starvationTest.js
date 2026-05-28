const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');

dotenv.config();

const BASE_URL = 'https://be.loaninneed.in';
const EXPORT_API_KEY = process.env.EXPORT_API_KEY || 'paromita$432';

const report = [];
function logMsg(msg) {
    console.log(msg);
    report.push(msg);
}

// ---------------------------------------------------------
// Helper: Run Test
// ---------------------------------------------------------
async function runTestBatch(endpoint, payload, method, concurrency, headers = {}) {
    const requests = [];
    const start = Date.now();
    for (let i = 0; i < concurrency; i++) {
        if (method === 'GET') {
            requests.push(axios.get(endpoint, { headers, timeout: 20000 }).then(res => Date.now() - start).catch(err => -1));
        } else {
            requests.push(axios.post(endpoint, payload, { headers, timeout: 20000 }).then(res => Date.now() - start).catch(err => -1));
        }
    }
    const results = await Promise.all(requests);
    const successes = results.filter(t => t !== -1);
    const avg = successes.reduce((a, b) => a + b, 0) / (successes.length || 1);
    const successRate = (successes.length / concurrency) * 100;
    
    return {
        concurrency,
        avgLatency: avg,
        successRate,
        failed: concurrency - successes.length
    };
}

// ---------------------------------------------------------
// Runner
// ---------------------------------------------------------
async function runStarvationAnalysis() {
    logMsg('========================================================');
    logMsg('    INFRASTRUCTURE STARVATION ANALYSIS TEST');
    logMsg('========================================================\n');
    logMsg('This test calculates the "Starvation Multiplier" by comparing');
    logMsg('baseline ideal traffic (10 reqs) vs heavy traffic (300 reqs).');
    logMsg('A healthy system (e.g., 4 vCPU) degrades by ~1.5x to 3x.');
    logMsg('A starving system (1 vCPU) degrades by 20x or more.\n');

    try {
        // Setup a dummy user to get an auth token for DB writes
        const jwt = require('jsonwebtoken');
        const JWT_SECRET = process.env.JWT_SECRET || 'paromita@2611#2104';
        const dummyToken = jwt.sign({ id: 1, role: 'CUSTOMER' }, JWT_SECRET, { expiresIn: '1h' });

        const endpoints = [
            { name: 'Pure Network (Health)', method: 'GET', url: `${BASE_URL}/`, payload: null },
            { name: 'CPU Bound (Logic)', method: 'POST', url: `${BASE_URL}/api/loans/check-eligibility`, payload: { income: 50000, expense: 20, tenure: 5 } },
            { name: 'DB Read Heavy (Loan Status)', method: 'GET', url: `${BASE_URL}/api/loans/status?linId=1`, payload: null, headers: { 'Authorization': `Key ${EXPORT_API_KEY}` } },
            { name: 'DB Write Heavy (Apply Loan)', method: 'POST', url: `${BASE_URL}/api/loans/apply`, payload: { loanAmount: 10000, loanType: 'OTHER' }, headers: { 'Authorization': `Bearer ${dummyToken}` } }
        ];

        let totalStarvationMultiplier = 0;

        for (const ep of endpoints) {
            logMsg(`\n--- Testing Layer: ${ep.name} ---`);
            
            // 1. Baseline
            logMsg('Running Baseline (Concurrency: 10)...');
            const baseline = await runTestBatch(ep.url, ep.payload, ep.method, 10, ep.headers || {});
            logMsg(`  Baseline Latency: ${baseline.avgLatency.toFixed(2)}ms`);

            // Let the event loop rest
            await new Promise(r => setTimeout(r, 2000));

            // 2. Stress
            logMsg('Running Stress (Concurrency: 300)...');
            const stress = await runTestBatch(ep.url, ep.payload, ep.method, 300, ep.headers || {});
            logMsg(`  Stress Latency: ${stress.avgLatency.toFixed(2)}ms | Failures: ${stress.failed}`);

            // 3. Calculation
            let multiplier = stress.avgLatency / (baseline.avgLatency || 1);
            if (stress.failed > 0) multiplier += (stress.failed * 0.1); // Penalize for timeouts
            
            logMsg(`  => Starvation Multiplier: ${multiplier.toFixed(2)}x`);
            totalStarvationMultiplier += multiplier;
            
            await new Promise(r => setTimeout(r, 3000));
        }

        const avgStarvation = totalStarvationMultiplier / endpoints.length;

        logMsg('\n========================================================');
        logMsg('                 FINAL STARVATION GRADE                 ');
        logMsg('========================================================');
        logMsg(`Average Starvation Multiplier: ${avgStarvation.toFixed(2)}x`);
        
        if (avgStarvation < 5) {
            logMsg('Grade: A (System is well-resourced)');
        } else if (avgStarvation < 15) {
            logMsg('Grade: C (System is straining under load, minor upgrades needed)');
        } else if (avgStarvation < 40) {
            logMsg('Grade: F (System is severely starved for CPU/RAM)');
        } else {
            logMsg('Grade: CRITICAL (System is choking to death. Imminent architecture collapse under moderate traffic)');
        }

        const fs = require('fs');
        fs.writeFileSync('starvation_report.txt', report.join('\n'));
        logMsg(`\nReport saved to starvation_report.txt`);
        
    } catch (e) {
        console.error('Fatal Error:', e);
    }
}

runStarvationAnalysis();
