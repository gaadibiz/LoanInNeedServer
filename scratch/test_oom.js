const axios = require('axios');
const fs = require('fs');
const crypto = require('crypto');

const API_KEY = 'paromita$432';

async function testAuditOOM() {
    console.log("Starting load test on audit logs...");
    
    const dummyRecord = {
        auditedAt: new Date().toISOString(),
        triggeredBy: 'SYSTEM',
        userId: Math.floor(Math.random() * 10000),
        customerId: 'LIN_' + Math.floor(Math.random() * 10000),
        applicationId: Math.floor(Math.random() * 10000),
        customerName: 'Test Dummy User with very long name to inflate the size of the file ' + crypto.randomBytes(50).toString('hex'),
        phone: '9999999999',
        email: 'test@dummy.com',
        category: 'INCOMPLETE_FRESH_LOAN',
        isProfileComplete: false,
        isReloan: false,
        totalApplications: 1,
        panVerified: false,
        aadhaarVerified: false,
        exportEligible: false,
        issues: ['PAN is missing', 'Aadhaar is missing', 'Bank statement is missing'],
        warnings: ['No address', 'No employment'],
        correctness: {}
    };

    const str = JSON.stringify(dummyRecord) + '\n';
    const logPath = './logs/audit/application-audit.log';
    
    if (!fs.existsSync('./logs/audit')) {
        fs.mkdirSync('./logs/audit', { recursive: true });
    }
    
    const stream = fs.createWriteStream(logPath, { flags: 'a' });
    // Write 200,000 lines (~150MB file)
    for (let i = 0; i < 200000; i++) {
        stream.write(str);
    }
    stream.end();
    
    await new Promise(r => stream.on('finish', r));
    console.log("Inflated log file.");

    try {
        console.log("Calling Audit Logs API concurrently...");
        const promises = [];
        for (let i = 0; i < 5; i++) {
            promises.push(axios.get('http://localhost:5000/api/audit/logs?page=1&limit=50', {
                headers: { 'Authorization': `Key ${API_KEY}` }
            }));
        }
        await Promise.all(promises);
        console.log("Calls succeeded");
    } catch (e) {
        console.log("API Error (Audit):", e.message);
    }
}

testAuditOOM();
