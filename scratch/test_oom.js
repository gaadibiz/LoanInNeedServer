const axios = require('axios');

const API_KEY = 'paromita$432';
const LOCAL_URL = 'http://localhost:5000/api/loans/export';

async function testLocalConcurrencyLimit() {
    console.log("Starting Concurrency Limit (Load Shedding) test on Local API...");
    const from = '2020-01-01T00:00:00Z';
    const to = '2026-12-31T23:59:59Z';
    const url = `${LOCAL_URL}?from=${from}&to=${to}`;

    console.log("Firing 10 simultaneous export requests to simulate multiple users clicking Export...");
    const promises = [];
    
    for (let i = 0; i < 10; i++) {
        promises.push(
            axios.get(url, {
                headers: { 'Authorization': `Key ${API_KEY}` },
                responseType: 'stream',
                timeout: 30000
            }).then(res => {
                console.log(`✅ Request ${i + 1}: Started Successfully (Status: ${res.status})`);
                // Let the stream run for a brief moment to occupy the concurrency slot
                return new Promise(resolve => {
                    setTimeout(() => {
                        res.data.destroy();
                        resolve();
                    }, 5000);
                });
            }).catch(err => {
                if (err.response) {
                    if (err.response.status === 429) {
                        console.log(`🛡️ Request ${i + 1}: Safely Blocked! (Status: 429 - System Busy)`);
                    } else {
                        console.log(`❌ Request ${i + 1}: Error - Status ${err.response.status}`);
                    }
                } else {
                    console.log(`❌ Request ${i + 1}: Network Error - ${err.message}`);
                }
            })
        );
    }

    await Promise.all(promises);
    console.log("\nConcurrency Test Complete! Notice how only a maximum of 2 requests were allowed to run, while the others were safely shed with 429s to prevent OOM.");
}

testLocalConcurrencyLimit();
