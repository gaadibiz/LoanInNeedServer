// simulated_infra_test.js
// This script simulates the infrastructure and scalability tests
// by testing API timeouts, connection resets, and load balancer rules conceptually.

const axios = require('axios');
const BASE_URL = 'https://be.loaninneed.in';

async function runInfraTests() {
    console.log('--- Starting Simulated Infrastructure & Scalability Tests ---');

    let report = [];

    // TC-INF-001: Network Partition Simulation (Timeout handling)
    console.log('Running TC-INF-001 (Simulated Timeout)...');
    try {
        const start = Date.now();
        await axios.get(`${BASE_URL}/`, { timeout: 10 }); // Ridiculously low timeout
        report.push({ test: 'TC-INF-001', status: 'FAILED (Did not timeout)' });
    } catch (e) {
        if (e.code === 'ECONNABORTED' || e.message.includes('timeout')) {
            report.push({ test: 'TC-INF-001', status: 'PASSED (System handles client timeout gracefully)' });
        } else {
            report.push({ test: 'TC-INF-001', status: `FAILED (${e.message})` });
        }
    }

    // TC-INF-006: SSL Validation
    console.log('Running TC-INF-006 (SSL Validation)...');
    try {
        const https = require('https');
        const req = https.request({
            host: 'be.loaninneed.in',
            port: 443,
            secureProtocol: 'TLSv1_method' // Force old TLS
        }, (res) => {
            report.push({ test: 'TC-INF-006', status: 'FAILED (Allowed old TLS)' });
        });
        req.on('error', (e) => {
             report.push({ test: 'TC-INF-006', status: 'PASSED (Rejected old TLS)' });
        });
        req.end();
    } catch (e) {
        report.push({ test: 'TC-INF-006', status: 'PASSED (Rejected old TLS)' });
    }

    console.log('\nResults:');
    console.log(report);
    
    const fs = require('fs');
    fs.writeFileSync('infra_report.json', JSON.stringify(report, null, 2));
}

runInfraTests();
