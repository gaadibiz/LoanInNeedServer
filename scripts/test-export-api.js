require('dotenv').config();
process.env.EXPORT_API_KEY = 'test_key_123';
process.env.PORT = 5005; // Use different port to avoid conflict if already running
const supertest = require('supertest');
const app = require('../server');

async function run() {
    try {
        console.log('Waiting for server...');
        await new Promise(r => setTimeout(r, 2000)); // wait for boot

        console.log('Testing GET /api/loans/status...');
        const res1 = await supertest(app)
            .get('/api/loans/status')
            .set('Authorization', 'Key test_key_123');
        console.log('Status Response Status:', res1.status);
        if (res1.status === 200) {
             console.log('Status array sample:', res1.body.data.slice(0, 1));
        } else {
             console.log('Error data:', res1.body);
        }

        console.log('\nTesting GET /api/loans/export...');
        const res2 = await supertest(app)
            .get('/api/loans/export?from=2024-01-01&to=2026-12-31')
            .set('Authorization', 'Key test_key_123');
        console.log('Export Response Status:', res2.status);
        if (res2.status === 200) {
            console.log('Export array length:', res2.body.data ? res2.body.data.length : 0);
            if (res2.body.data && res2.body.data.length > 0) {
               console.log('Sample Export Data:', JSON.stringify(res2.body.data[0], null, 2));
            }
        } else {
            console.log('Error data:', res2.body);
        }
        
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
}
run();
