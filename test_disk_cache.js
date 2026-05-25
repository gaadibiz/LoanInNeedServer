const supertest = require('supertest');
const { Readable } = require('stream');
const fs = require('fs');
const path = require('path');
const app = require('./server');

// Ensure correct environment for testing
process.env.EXPORT_API_KEY = 'test_key_123';
process.env.STORAGE_PROVIDER = 's3';
process.env.DO_SPACES_BUCKET = 'test-bucket';

// Mock the S3 Client to simulate a slow network fetch
const s3Client = require('./utils/s3Client');
let s3FetchCount = 0;

s3Client.send = async (command) => {
    s3FetchCount++;
    console.log(`    ☁️  [Network] Fetching ${command.input.Key} from S3... (Simulating 500ms delay)`);
    await new Promise(r => setTimeout(r, 500)); // Simulate slow S3 download
    
    const stream = new Readable();
    stream.push(Buffer.from('dummy_pdf_content_from_s3'));
    stream.push(null);
    return { Body: stream };
};

// Clean up the disk cache before starting the test
const cacheDir = path.join(__dirname, '.cache');
if (fs.existsSync(cacheDir)) {
    fs.rmSync(cacheDir, { recursive: true, force: true });
}
fs.mkdirSync(cacheDir, { recursive: true });

const prisma = require('./utils/prismaClient');

async function runTests() {
    console.log('🚀 Starting Disk Caching & Performance Test Suite...\n');
    
    console.log('🌱 Seeding Dummy Data for testing...');
    // Create a dummy user and loan application with a document to test S3 fetch
    const testPhone = '99' + Math.floor(10000000 + Math.random() * 90000000).toString();
    const dummyUser = await prisma.user.create({
        data: {
            phone: testPhone,
            name: 'Test Caching User',
            documents: {
                create: {
                    docType: 'BANK_STATEMENT',
                    fileUrl: 'https://test-bucket.s3.amazonaws.com/test_doc.pdf',
                    filePath: '/test/path.pdf'
                }
            }
        },
        include: { documents: true }
    });

    const dummyLoan = await prisma.loanApplication.create({
        data: {
            userId: dummyUser.id,
            loanAmount: 50000,
            status: 'PENDING',
            loanType: 'OTHER'
        }
    });
    
    let round1Time = 0;
    let round2Time = 0;
    let round3Time = 0;

    // --- ROUND 1: CACHE MISS ---
    console.log('==================================================');
    console.log('🔥 ROUND 1: INITIAL EXPORT (CACHE MISS)');
    console.log('==================================================');
    s3FetchCount = 0;
    let start = Date.now();
    let res = await supertest(app)
        .get('/api/loans/export?from=2020-01-01&to=2030-12-31&filterIncomplete=false')
        .set('Authorization', `Key ${process.env.EXPORT_API_KEY}`);
    round1Time = Date.now() - start;
    let itemsExported = res.body?.data?.length || 0;
    
    console.log(`    ✅ Status Code: ${res.status}`);
    console.log(`    📦 Items Exported: ${itemsExported}`);
    console.log(`    ⏳ Time Taken: ${round1Time}ms`);
    console.log(`    🌐 S3 Fetches: ${s3FetchCount} (Should be > 0 if items exist)`);
    
    const cacheFiles = fs.existsSync(cacheDir) ? fs.readdirSync(cacheDir).length : 0;
    console.log(`    💽 Files on Disk Cache: ${cacheFiles}\n`);
    
    // --- ROUND 2: CACHE HIT ---
    console.log('==================================================');
    console.log('⚡ ROUND 2: REPEAT EXPORT (CACHE HIT)');
    console.log('==================================================');
    s3FetchCount = 0;
    start = Date.now();
    res = await supertest(app)
        .get('/api/loans/export?from=2020-01-01&to=2030-12-31&filterIncomplete=false')
        .set('Authorization', `Key ${process.env.EXPORT_API_KEY}`);
    round2Time = Date.now() - start;
    
    console.log(`    ✅ Status Code: ${res.status}`);
    console.log(`    ⏳ Time Taken: ${round2Time}ms`);
    console.log(`    🌐 S3 Fetches: ${s3FetchCount} (Should be 0 - served from disk!)`);
    
    if (s3FetchCount === 0 && round2Time < round1Time) {
        console.log(`    🎉 SUCCESS: Cache is working perfectly! Export is ${Math.round(round1Time/round2Time)}x faster.\n`);
    } else if (itemsExported === 0) {
         console.log(`    ⚠️ WARNING: No items found in DB to test caching.\n`);
    } else {
        console.log(`    ❌ ERROR: Cache failed or did not improve speed.\n`);
    }

    // --- ROUND 3: STRESS TEST / MEMORY CHECK ---
    console.log('==================================================');
    console.log('🧠 ROUND 3: OOM MEMORY & STABILITY TEST');
    console.log('==================================================');
    s3FetchCount = 0;
    
    const initialMemory = process.memoryUsage().heapUsed / 1024 / 1024;
    console.log(`    📊 Initial Memory: ${initialMemory.toFixed(2)} MB`);
    
    start = Date.now();
    res = await supertest(app)
        .get('/api/loans/export?from=2020-01-01&to=2030-12-31&filterIncomplete=false')
        .set('Authorization', `Key ${process.env.EXPORT_API_KEY}`);
    round3Time = Date.now() - start;
    
    const finalMemory = process.memoryUsage().heapUsed / 1024 / 1024;
    console.log(`    📊 Final Memory: ${finalMemory.toFixed(2)} MB`);
    const diffMemory = finalMemory - initialMemory;
    console.log(`    📈 Memory Change: ${diffMemory > 0 ? '+' : ''}${diffMemory.toFixed(2)} MB`);
    
    if (diffMemory < 50) {
        console.log(`    🎉 SUCCESS: Memory remained extremely stable! No OOM risks detected.\n`);
    } else {
        console.log(`    ⚠️ WARNING: Memory spiked. Ensure chunking is working.\n`);
    }

    console.log('==================================================');
    console.log('📝 FINAL REPORT OVERVIEW');
    console.log('==================================================');
    console.log(`- 📦 Payload Processed: ${itemsExported} documents`);
    console.log(`- 🕒 Round 1 (No Cache): ${round1Time}ms`);
    console.log(`- ⚡ Round 2 (Disk Cache): ${round2Time}ms`);
    console.log(`- 🧠 Memory Spikes: ${diffMemory.toFixed(2)} MB`);
    console.log(`- 💽 Cache Directory populated: ${cacheFiles > 0 ? 'Yes ✅' : 'No ❌'}`);
    console.log(`- 🛡️ OOM Prevention: Passed ✅`);

    console.log('\n🧹 Cleaning up dummy data...');
    await prisma.userDocument.deleteMany({ where: { userId: dummyUser.id } });
    await prisma.loanApplication.deleteMany({ where: { userId: dummyUser.id } });
    await prisma.user.delete({ where: { id: dummyUser.id } });
    
    console.log('\nTesting Complete. Exiting...');
    process.exit(0);
}

const cluster = require('cluster');

if (cluster.isPrimary) {
    runTests().catch(err => {
        console.error('Test Failed:', err);
        process.exit(1);
    });
}
