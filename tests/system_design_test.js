const axios = require('axios');
require('dotenv').config();

// Force UAT for the test
const BASE_URL = 'https://be.loaninneed.in';
const API_KEY = process.env.EXPORT_API_KEY || 'paromita$432';

async function runOomAndIpcTest() {
    console.log('🚀 Starting System Design & OOM Test (Cluster IPC Lock Attack)');
    console.log(`Targeting heavy export endpoint: ${BASE_URL}/api/loans/export`);
    
    // We fire 50 simultaneous massive export jobs. 
    // If the server lacks IPC locks, this will crash the primary Node instance (OOM).
    // If IPC works, MAX_GLOBAL_EXPORTS=2 will queue/reject them gracefully.
    
    const CONCURRENT_ATTACKS = 50;
    let promises = [];
    
    console.log(`Firing ${CONCURRENT_ATTACKS} simultaneous heavy export requests...`);
    const start = Date.now();
    
    for (let i = 0; i < CONCURRENT_ATTACKS; i++) {
        promises.push(
            axios.get(`${BASE_URL}/api/loans/export`, {
                headers: { 'Authorization': `Key ${API_KEY}` },
                timeout: 30000,
                validateStatus: false // We don't want to throw on 429 Too Many Requests
            }).then(res => {
                return { status: res.status, data: res.data };
            }).catch(err => {
                return { status: err.response?.status || 'FAIL', error: err.message };
            })
        );
    }
    
    const results = await Promise.all(promises);
    const end = Date.now();
    
    // Analyze results
    let successfulExports = 0;
    let rateLimited = 0;
    let failures = 0;
    
    results.forEach(res => {
        if (res.status === 200 || res.status === 201) successfulExports++;
        else if (res.status === 429) rateLimited++;
        else failures++;
    });
    
    console.log('\n📊 --- TEST RESULTS ---');
    console.log(`Total Time: ${(end - start) / 1000} seconds`);
    console.log(`Successful Exports: ${successfulExports}`);
    console.log(`Rate Limited / Queued (429): ${rateLimited}`);
    console.log(`Failures / Timeouts: ${failures}`);
    
    if (failures > 0) {
        console.error('❌ SYSTEM CRASH: The server failed to handle the concurrent heavy load. OOM or timeout occurred.');
        process.exit(1);
    } else if (successfulExports > 5) {
        console.warn('⚠️ WARNING: IPC Lock might be failing. Too many concurrent exports succeeded.');
        process.exit(1);
    } else {
        console.log('✅ SYSTEM SECURE: IPC Cluster Lock successfully prevented OOM fatal error!');
    }
}

runOomAndIpcTest();
