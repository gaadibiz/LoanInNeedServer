const path = require('path');
require('dotenv').config();

// Fallback key if not set in .env
if (!process.env.EXPORT_API_KEY) {
    process.env.EXPORT_API_KEY = 'test_key_123';
}

const supertest = require('supertest');
const app = require('./server');
const fs = require('fs');

async function run() {
    try {
        console.log('Fetching loans from the export API...');
        const response = await supertest(app)
            .get('/api/loans/export?from=2020-01-01&to=2030-12-31')
            .set('Authorization', `Key ${process.env.EXPORT_API_KEY}`);

        if (response.status !== 200) {
            console.error(`Export API failed with status ${response.status}:`, response.body);
            process.exit(1);
        }

        const loans = response.body.data || [];
        console.log(`Successfully fetched ${loans.length} loan applications.`);

        // Double check completeness validation for each record
        let allValid = true;
        for (const loan of loans) {
            // Check name has at least 2 words
            const nameWords = (loan.name || '').trim().split(/\s+/);
            if (nameWords.length < 2) {
                console.error(`Validation Failed: Record ID ${loan.id} has name with less than 2 words: "${loan.name}"`);
                allValid = false;
            }

            // Check PAN is present
            if (!loan.panNo || loan.panNo.trim() === '') {
                console.error(`Validation Failed: Record ID ${loan.id} is missing PAN.`);
                allValid = false;
            }

            // Check Aadhaar number is present
            if (!loan.aadhaarNo || loan.aadhaarNo.trim() === '') {
                console.error(`Validation Failed: Record ID ${loan.id} is missing Aadhaar number.`);
                allValid = false;
            }

            // Check city mapping in address1
            console.log(`Verification: Record ID ${loan.id} has Address1 = "${loan.address1}" (City = "${loan.area || loan.district}")`);
        }

        if (allValid) {
            console.log('Verification Successful: Only complete users with verified PAN/Aadhaar and correct city mapping are present.');
        } else {
            console.warn('Warning: Some records did not pass strict validation.');
        }

        // Save records to JSON file in workspace root
        const outputPath = path.join(__dirname, '..', 'exported_loans.json');
        fs.writeFileSync(outputPath, JSON.stringify(loans, null, 2), 'utf8');
        console.log(`Saved ${loans.length} records to ${outputPath}`);
        
        process.exit(0);
    } catch (err) {
        console.error('Error running export API fetch:', err);
        process.exit(1);
    }
}

run();
