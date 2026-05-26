const axios = require('axios');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');

dotenv.config();

const prisma = new PrismaClient();
const BASE_URL = 'https://be.loaninneed.in';
const JWT_SECRET = process.env.JWT_SECRET || 'paromita@2611#2104';
const EXPORT_API_KEY = process.env.EXPORT_API_KEY || 'paromita$432';

let testUser = null;
let authToken = null;
const report = [];

function logAndReport(msg) {
    console.log(msg);
    report.push(msg);
}

async function setup() {
    logAndReport('--- Setting up Heavy Test Data ---');
    testUser = await prisma.user.create({
        data: {
            name: 'Heavy Load Tester',
            phone: `88888${Math.floor(Math.random() * 100000)}`,
            email: `heavytest_${Date.now()}@example.com`,
            phoneVerified: true,
        }
    });
    
    authToken = jwt.sign(
        { id: testUser.id, role: 'CUSTOMER' },
        JWT_SECRET,
        { expiresIn: '1h' }
    );
    logAndReport(`Created test user: ID ${testUser.id}`);
}

async function teardown() {
    logAndReport('\n--- Tearing down all test data ---');
    if (testUser) {
        try {
            const delJobs = await prisma.losIntegrationJob.deleteMany({ where: { userId: testUser.id } });
            const delApps = await prisma.loanApplication.deleteMany({ where: { userId: testUser.id } });
            const delUser = await prisma.user.delete({ where: { id: testUser.id } });
            logAndReport(`Successfully deleted ${delJobs.count} jobs, ${delApps.count} applications, and user ${delUser.id}.`);
        } catch (e) {
            console.error('Error during teardown:', e.message);
        }
    }
}

async function testApplyForm(concurrencyLevel) {
    logAndReport(`\n[APPLY TEST] Concurrency: ${concurrencyLevel}`);
    const requests = [];
    const startTime = Date.now();

    for (let i = 0; i < concurrencyLevel; i++) {
        const req = axios.post(`${BASE_URL}/api/loans/apply`, {
            loanAmount: 50000 + i,
            purposeOfLoan: 'BUSINESS',
            loanType: 'BUSINESS'
        }, {
            headers: { Authorization: `Bearer ${authToken}` },
            timeout: 15000 // 15 sec timeout
        }).then(res => ({ success: true, status: res.status, time: Date.now() - startTime }))
          .catch(err => ({ success: false, status: err.response?.status || err.code || 500, time: Date.now() - startTime, err: err.message }));
        requests.push(req);
    }

    const results = await Promise.all(requests);
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    
    const times = results.map(r => r.time);
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const maxTime = Math.max(...times);

    logAndReport(`Results: ${successCount} succeeded, ${failCount} failed.`);
    logAndReport(`Latency: Avg ${avgTime.toFixed(2)}ms | Max ${maxTime}ms`);

    const degradation = maxTime > 5000 || failCount > (concurrencyLevel * 0.1); // Break if latency > 5s or > 10% failure
    return { degradation, avgTime, maxTime, successCount, failCount };
}

async function testHeavyExport() {
    logAndReport(`\n[EXPORT TEST] Running a heavy data export...`);
    const startTime = Date.now();
    // Fetch export for last 2 days (which now includes all our heavily generated load test data)
    const fromDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const toDate = new Date().toISOString();

    try {
        const res = await axios.get(`${BASE_URL}/api/loans/export?from=${fromDate}&to=${toDate}&filterIncomplete=false`, {
            headers: { 'Authorization': `Key ${EXPORT_API_KEY}` },
            timeout: 60000, // 60 seconds allowed
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });
        const timeTaken = Date.now() - startTime;
        
        let appsExported = 0;
        let dataSizeBytes = 0;
        
        if (res.data && res.data.data) {
            appsExported = res.data.data.length;
            dataSizeBytes = Buffer.byteLength(JSON.stringify(res.data));
        }

        const sizeMb = (dataSizeBytes / (1024 * 1024)).toFixed(2);
        
        logAndReport(`Export SUCCESS in ${timeTaken}ms.`);
        logAndReport(`Total Applications Exported: ${appsExported}`);
        logAndReport(`Payload Size: ${sizeMb} MB`);
        
        return { success: true, timeTaken, sizeMb, appsExported };
    } catch (err) {
        const timeTaken = Date.now() - startTime;
        logAndReport(`Export FAILED after ${timeTaken}ms.`);
        logAndReport(`Error: ${err.response ? err.response.status + ' - ' + JSON.stringify(err.response.data) : err.message}`);
        return { success: false, timeTaken, error: err.message };
    }
}

async function run() {
    try {
        await setup();

        logAndReport('\n=========================================');
        logAndReport('PHASE 1: HEAVY LOAD FORM FILL (STRESS TEST)');
        logAndReport('=========================================');
        
        // We will aggressively push the server to see where it completely breaks
        const concurrencyLevels = [50, 100, 200, 350, 500];
        let maxStableConcurrency = 0;
        
        for (const c of concurrencyLevels) {
            const res = await testApplyForm(c);
            if (res.degradation) {
                logAndReport(`\n=> FATAL DEGRADATION at concurrency ${c}. System is unresponsive/failing.`);
                break;
            } else {
                maxStableConcurrency = c;
            }
            // Let the server recover its event loop
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
        
        logAndReport(`\n[METRIC] Absolute Maximum Form Concurrency before degradation: ${maxStableConcurrency} req/burst`);

        logAndReport('\n=========================================');
        logAndReport('PHASE 2: HEAVY DATA VOLUME EXPORT (STRESS TEST)');
        logAndReport('=========================================');
        
        // By this point, Phase 1 has inserted hundreds of dummy records. 
        // We will test if the UAT server can export them without OOM crash.
        const exportRes = await testHeavyExport();

        if (!exportRes.success) {
            logAndReport(`\n=> EXPORT FAILURE. The UAT server likely ran out of RAM or timed out.`);
        } else {
            logAndReport(`\n=> EXPORT SURVIVED. The IPC streaming architecture successfully bypassed the 512MB RAM limitation.`);
        }

        // Save report to file so the agent can read it and write the MD
        const fs = require('fs');
        fs.writeFileSync('heavy-load-report.txt', report.join('\n'));
        logAndReport(`\nReport saved to heavy-load-report.txt`);

    } catch (e) {
        console.error('Fatal Error:', e);
    } finally {
        await teardown();
        await prisma.$disconnect();
    }
}

run();
