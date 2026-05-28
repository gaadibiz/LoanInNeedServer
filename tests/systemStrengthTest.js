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

function logMsg(msg) {
    console.log(msg);
    report.push(msg);
}

// ---------------------------------------------------------
// Setup & Teardown
// ---------------------------------------------------------
async function setup() {
    logMsg('--- Initializing Comprehensive System Strength Test ---');
    testUser = await prisma.user.create({
        data: {
            name: 'System Strength Tester',
            phone: `77777${Math.floor(Math.random() * 100000)}`,
            email: `strength_${Date.now()}@example.com`,
            phoneVerified: true,
        }
    });
    
    authToken = jwt.sign(
        { id: testUser.id, role: 'CUSTOMER' },
        JWT_SECRET,
        { expiresIn: '1h' }
    );
    logMsg(`Test user created with ID: ${testUser.id}`);
}

async function teardown() {
    logMsg('\n--- Cleaning up test data ---');
    if (testUser) {
        try {
            await prisma.losIntegrationJob.deleteMany({ where: { userId: testUser.id } });
            await prisma.loanApplication.deleteMany({ where: { userId: testUser.id } });
            await prisma.user.delete({ where: { id: testUser.id } });
            logMsg('Cleanup complete.');
        } catch (e) {
            console.error('Cleanup error:', e.message);
        }
    }
}

// ---------------------------------------------------------
// Test 1: CPU & Basic Network Load (Health Check)
// ---------------------------------------------------------
async function testHealthCheck(concurrency) {
    logMsg(`\n[TEST 1] Health Check (Network/Express Overhead) - Concurrency: ${concurrency}`);
    const requests = [];
    const start = Date.now();
    for (let i = 0; i < concurrency; i++) {
        requests.push(axios.get(`${BASE_URL}/`).then(res => Date.now() - start).catch(() => -1));
    }
    const results = await Promise.all(requests);
    const successes = results.filter(t => t !== -1);
    const avg = successes.reduce((a, b) => a + b, 0) / (successes.length || 1);
    logMsg(`Success: ${successes.length}/${concurrency} | Avg Time: ${avg.toFixed(2)}ms`);
}

// ---------------------------------------------------------
// Test 2: CPU-Bound Logic (Eligibility Calculator)
// ---------------------------------------------------------
async function testEligibilityLogic(concurrency) {
    logMsg(`\n[TEST 2] CPU-Bound Logic (Eligibility) - Concurrency: ${concurrency}`);
    const requests = [];
    const start = Date.now();
    for (let i = 0; i < concurrency; i++) {
        requests.push(axios.post(`${BASE_URL}/api/loans/check-eligibility`, {
            income: 50000, expense: 20, tenure: 5
        }).then(res => Date.now() - start).catch(() => -1));
    }
    const results = await Promise.all(requests);
    const successes = results.filter(t => t !== -1);
    const avg = successes.reduce((a, b) => a + b, 0) / (successes.length || 1);
    logMsg(`Success: ${successes.length}/${concurrency} | Avg Time: ${avg.toFixed(2)}ms`);
}

// ---------------------------------------------------------
// Test 3: DB Read Load (Status Check API)
// ---------------------------------------------------------
async function testDbReads(concurrency) {
    logMsg(`\n[TEST 3] DB Read Heavy (Loan Status Check) - Concurrency: ${concurrency}`);
    const requests = [];
    const start = Date.now();
    for (let i = 0; i < concurrency; i++) {
        requests.push(axios.get(`${BASE_URL}/api/loans/status?linId=${testUser.id}`, {
            headers: { 'Authorization': `Key ${EXPORT_API_KEY}` }
        }).then(res => Date.now() - start).catch(() => -1));
    }
    const results = await Promise.all(requests);
    const successes = results.filter(t => t !== -1);
    const avg = successes.reduce((a, b) => a + b, 0) / (successes.length || 1);
    logMsg(`Success: ${successes.length}/${concurrency} | Avg Time: ${avg.toFixed(2)}ms`);
}

// ---------------------------------------------------------
// Test 4: Mixed Real-World Workload
// ---------------------------------------------------------
async function testMixedWorkload(totalRequests) {
    logMsg(`\n[TEST 4] Mixed Real-World Workload (Read/Write/Logic) - Total Requests: ${totalRequests}`);
    const requests = [];
    const start = Date.now();
    
    // Distribute traffic: 50% reads, 30% health/logic, 20% writes
    for (let i = 0; i < totalRequests; i++) {
        const rand = Math.random();
        if (rand < 0.5) {
            // Read
            requests.push(axios.get(`${BASE_URL}/api/loans/status?linId=${testUser.id}`, { headers: { 'Authorization': `Key ${EXPORT_API_KEY}` } }).then(res => Date.now() - start).catch(() => -1));
        } else if (rand < 0.8) {
            // Logic
            requests.push(axios.post(`${BASE_URL}/api/loans/check-eligibility`, { income: 50000, expense: 20, tenure: 5 }).then(res => Date.now() - start).catch(() => -1));
        } else {
            // Write
            requests.push(axios.post(`${BASE_URL}/api/loans/apply`, { loanAmount: 10000, loanType: 'OTHER' }, { headers: { Authorization: `Bearer ${authToken}` } }).then(res => Date.now() - start).catch(() => -1));
        }
    }

    const results = await Promise.all(requests);
    const successes = results.filter(t => t !== -1);
    const avg = successes.reduce((a, b) => a + b, 0) / (successes.length || 1);
    logMsg(`Success: ${successes.length}/${totalRequests} | Total Time to resolve all: ${Math.max(...successes)}ms | Avg Time: ${avg.toFixed(2)}ms`);
}

// ---------------------------------------------------------
// Runner
// ---------------------------------------------------------
async function run() {
    try {
        await setup();
        
        // Target: 200 concurrency (which previously broke the DB writes). Let's see how purely CPU/Network/Reads handle it.
        const targetConcurrency = 200; 

        await testHealthCheck(targetConcurrency);
        await new Promise(r => setTimeout(r, 2000));
        
        await testEligibilityLogic(targetConcurrency);
        await new Promise(r => setTimeout(r, 2000));
        
        await testDbReads(targetConcurrency);
        await new Promise(r => setTimeout(r, 2000));
        
        // Push mixed workload up to 300
        await testMixedWorkload(300);

        logMsg('\n[CONCLUSION] Test complete. Review metrics for bottlenecks.');
    } catch (e) {
        console.error('Fatal Error:', e);
    } finally {
        await teardown();
        await prisma.$disconnect();
    }
}

run();
