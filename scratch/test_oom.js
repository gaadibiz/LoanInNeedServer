const axios = require('axios');

const API_KEY = 'paromita$432';
const PROD_URL = 'https://be.loaninneed.in/api/loans/export';

async function testProductionExportPerformance() {
    console.log("🚀 Testing Optimized Production API Performance...");
    const from = '2020-01-01T00:00:00Z';
    const to = '2026-12-31T23:59:59Z';
    const url = `${PROD_URL}?from=${from}&to=${to}`;

    console.log(`Sending Export Request to: ${url}`);
    
    const startTime = Date.now();
    let firstByteTime = null;

    try {
        const response = await axios.get(url, {
            headers: { 'Authorization': `Key ${API_KEY}` },
            responseType: 'stream',
            timeout: 60000 // 60 sec timeout for headers
        });
        
        let byteCount = 0;
        let chunkCount = 0;

        response.data.on('data', (chunk) => {
            if (!firstByteTime) {
                firstByteTime = Date.now();
                console.log(`\n⏱️  Time to First Byte (Headers Received): ${((firstByteTime - startTime) / 1000).toFixed(2)}s`);
                process.stdout.write("Downloading stream... ");
            }
            byteCount += chunk.length;
            chunkCount++;
            if (chunkCount % 100 === 0) {
                 process.stdout.write(".");
            }
        });

        await new Promise((resolve, reject) => {
            response.data.on('end', resolve);
            response.data.on('error', reject);
        });

        const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
        const downloadTime = ((Date.now() - firstByteTime) / 1000).toFixed(2);
        const mbReceived = (byteCount / 1024 / 1024).toFixed(2);
        
        console.log(`\n\n✅ Export Completed Successfully!`);
        console.log(`📊 Total Data Received: ${mbReceived} MB`);
        console.log(`📊 Time to Start Stream: ${((firstByteTime - startTime) / 1000).toFixed(2)} seconds`);
        console.log(`📊 Time to Download Stream: ${downloadTime} seconds`);
        console.log(`📊 Total Total Time: ${totalTime} seconds`);
        
    } catch (e) {
        const timeTaken = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`\n❌ API Error after ${timeTaken}s:`, e.message);
        if (e.response) {
            console.log("Status:", e.response.status);
            if (e.response.status === 429) {
                console.log("🛡️ Safely blocked by Concurrency Limiter (System Busy).");
            }
        }
    }
}

testProductionExportPerformance();
