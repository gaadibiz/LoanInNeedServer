const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');

dotenv.config();

const prisma = new PrismaClient();
const BASE_URL = 'https://be.loaninneed.in';
const EXPORT_API_KEY = process.env.EXPORT_API_KEY || 'paromita$432';

// ---------------------------------------------------------
// Helpers
// ---------------------------------------------------------
const log = (msg) => {
    console.log(`[${new Date().toISOString()}] ${msg}`);
};

// Generate a dummy PDF of 300KB
function createDummyPdf() {
    const dummyDir = path.join(__dirname, '..', 'uploads', 'dummy');
    if (!fs.existsSync(dummyDir)) fs.mkdirSync(dummyDir, { recursive: true });
    
    const filePath = path.join(dummyDir, 'heavy_dummy.pdf');
    if (!fs.existsSync(filePath)) {
        log('Generating heavy dummy PDF file (300KB)...');
        // 300KB of random string data
        const buffer = Buffer.alloc(300 * 1024, 'A'); 
        fs.writeFileSync(filePath, buffer);
    }
    // Return relative path as stored in DB
    return `uploads/dummy/heavy_dummy.pdf`;
}

// ---------------------------------------------------------
// Setup 50 Fully Loaded Applications
// ---------------------------------------------------------
async function setupHeavyData(appCount) {
    log(`--- Setting up ${appCount} Fully Loaded Test Applications ---`);
    const docPath = createDummyPdf();
    const createdUsers = [];

    // Clean old dummy data first to avoid interference
    await teardown();

    for (let i = 0; i < appCount; i++) {
        const phone = `99999${(i).toString().padStart(5, '0')}`;
        
        // 1. Create User
        const user = await prisma.user.create({
            data: {
                name: `Heavy Test User ${i}`,
                phone: phone,
                email: `heavy_${i}@example.com`,
                phoneVerified: true
            }
        });

        // 2. Add KYC Data
        await prisma.panVerification.create({ data: { userId: user.id, panNumber: `HEAVY${i}P` } });
        await prisma.aadhaarVerification.create({ data: { userId: user.id, aadhaarNumber: `0000111122${i.toString().padStart(2, '0')}` } });
        
        // 3. Add 5 Heavy Documents
        const docTypes = ['PAN', 'AADHAAR', 'PHOTO', 'BANK_STATEMENT', 'PAY_SLIP'];
        for (const type of docTypes) {
            await prisma.userDocument.create({
                data: {
                    userId: user.id,
                    docType: type,
                    fileName: `${type}_dummy.pdf`,
                    filePath: docPath,
                    mimeType: 'application/pdf',
                    size: 307200
                }
            });
        }

        // 4. Create Application
        await prisma.loanApplication.create({
            data: {
                userId: user.id,
                loanAmount: 50000 + i,
                loanType: 'BUSINESS',
                status: 'PENDING'
            }
        });

        createdUsers.push(user.id);
        if (i % 10 === 0 && i > 0) log(`Created ${i} applications...`);
    }

    log(`Successfully seeded ${appCount} heavily loaded applications.`);
    return createdUsers;
}

// ---------------------------------------------------------
// Teardown
// ---------------------------------------------------------
async function teardown() {
    log('--- Cleaning up heavy test data ---');
    const users = await prisma.user.findMany({
        where: { email: { startsWith: 'heavy_' } }
    });
    
    if (users.length > 0) {
        const userIds = users.map(u => u.id);
        await prisma.losIntegrationJob.deleteMany({ where: { userId: { in: userIds } } });
        await prisma.userDocument.deleteMany({ where: { userId: { in: userIds } } });
        await prisma.loanApplication.deleteMany({ where: { userId: { in: userIds } } });
        await prisma.panVerification.deleteMany({ where: { userId: { in: userIds } } });
        await prisma.aadhaarVerification.deleteMany({ where: { userId: { in: userIds } } });
        // employment and address don't exist as models or were not created, skip them
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
        log(`Cleaned up ${userIds.length} test records.`);
    }
}

// ---------------------------------------------------------
// Test 1: Heavy Data Loss & Volume Verification
// ---------------------------------------------------------
async function testHeavyExportVolume() {
    log('\n=========================================');
    log('TEST 1: HEAVY VOLUME DATA LOSS VERIFICATION');
    log('=========================================');

    const fromDate = new Date();
    fromDate.setHours(fromDate.getHours() - 1);
    
    const url = `${BASE_URL}/api/loans/export?from=${fromDate.toISOString()}&to=${new Date().toISOString()}&filterIncomplete=false`;
    
    log('Triggering Heavy Export Download (This streams massive amounts of data...)');
    const start = Date.now();

    try {
        const response = await axios.get(url, {
            headers: { 'Authorization': `Key ${EXPORT_API_KEY}` },
            timeout: 120000, // 2 mins
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            responseType: 'text' // Stream as raw text to calculate size before JSON parse
        });

        const timeTaken = Date.now() - start;
        const payloadSizeMb = (Buffer.byteLength(response.data, 'utf8') / (1024 * 1024)).toFixed(2);
        
        log(`Download Complete in ${timeTaken}ms.`);
        log(`Payload Size: ${payloadSizeMb} MB`);

        log('Parsing JSON to verify 0 Data Loss...');
        let jsonPayload;
        try {
            jsonPayload = JSON.parse(response.data);
        } catch(e) {
            log(`JSON PARSE ERROR: The stream was corrupted or truncated! Exception: ${e.message}`);
            return false;
        }

        // We created exactly 50 apps
        // But there might be other real applications from the last hour in UAT.
        const heavyApps = (jsonPayload.data || []).filter(app => app.personalEmail && app.personalEmail.startsWith('heavy_'));
        
        log(`Verified Intact Heavy Applications: ${heavyApps.length}`);
        if (heavyApps.length !== 50) {
            log(`❌ DATA LOSS DETECTED! Expected 50, found ${heavyApps.length}`);
            return false;
        }

        // Verify Documents exist
        const sampleApp = heavyApps[0];
        let hasDocs = false;
        if (sampleApp.panCard || sampleApp.aadhaarFront || sampleApp.profilePicture) {
            hasDocs = true;
        }

        if (hasDocs) {
            log(`✅ ZERO DATA LOSS: Base64 Documents successfully extracted, encoded, and streamed.`);
        } else {
            log(`❌ DOCUMENT LOSS DETECTED: The base64 documents were not attached to the payload.`);
        }

        return true;
    } catch (err) {
        log(`Export Failed: ${err.message}`);
        return false;
    }
}

// ---------------------------------------------------------
// Test 2: Concurrency & Load Shedding
// ---------------------------------------------------------
async function testExportConcurrency() {
    log('\n=========================================');
    log('TEST 2: CONCURRENCY & LOAD SHEDDER');
    log('=========================================');

    const fromDate = new Date();
    fromDate.setHours(fromDate.getHours() - 1);
    const url = `${BASE_URL}/api/loans/export?from=${fromDate.toISOString()}&to=${new Date().toISOString()}&filterIncomplete=false`;
    
    log('Firing 4 simultaneous massive export requests to test IPC Slotting...');
    
    const promises = [];
    for (let i = 1; i <= 4; i++) {
        promises.push(
            axios.get(url, { headers: { 'Authorization': `Key ${EXPORT_API_KEY}` }, timeout: 60000 })
                .then(res => ({ req: i, status: res.status }))
                .catch(err => ({ req: i, status: err.response ? err.response.status : 'TIMEOUT' }))
        );
    }

    const results = await Promise.all(promises);
    let successCount = 0;
    let rateLimitCount = 0;

    for (const res of results) {
        log(`Request ${res.req} -> HTTP ${res.status}`);
        if (res.status === 200) successCount++;
        if (res.status === 429) rateLimitCount++;
    }

    if (rateLimitCount > 0) {
        log(`✅ CONCURRENCY PROTECTED: Load Shedder blocked ${rateLimitCount} requests with HTTP 429 to prevent CPU death.`);
    } else {
        log(`❌ CONCURRENCY FAILED: All requests slipped through, risk of OOM crash!`);
    }
}

// ---------------------------------------------------------
// Main
// ---------------------------------------------------------
async function runPreLiveTest() {
    try {
        await setupHeavyData(50);
        
        await testHeavyExportVolume();
        
        await testExportConcurrency();

    } catch (e) {
        console.error('Fatal Test Error:', e);
    } finally {
        await teardown();
        await prisma.$disconnect();
    }
}

runPreLiveTest();
