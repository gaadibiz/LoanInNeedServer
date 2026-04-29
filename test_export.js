const { exportLoanApplications } = require('./controllers/loanController');
const prisma = require('./utils/prismaClient');
const fs = require('fs');
const path = require('path');

async function runTest() {
    // 1. Create a dummy file in uploads/Documents/AADHAAR/1/
    const dirPath = path.join(__dirname, 'uploads', 'Documents', 'AADHAAR', '1');
    fs.mkdirSync(dirPath, { recursive: true });
    
    const filePath = path.join(dirPath, 'test_file.txt');
    fs.writeFileSync(filePath, 'This is a test document content');
    
    const relativePath = 'uploads/Documents/AADHAAR/1/test_file.txt';

    // 2. Insert dummy User, Document, and LoanApplication
    const user = await prisma.user.create({
        data: {
            phone: `99999${Date.now().toString().slice(-5)}`,
            name: 'Test User Base64',
            documents: {
                create: {
                    docType: 'AADHAAR',
                    filePath: relativePath,
                    fileName: 'test_file.txt'
                }
            },
            loanApplications: {
                create: {
                    loanAmount: 10000,
                    loanType: 'OTHER'
                }
            }
        }
    });

    // 3. Call export endpoint
    const req = {
        query: { from: '2020-01-01', to: '2030-12-31' }
    };

    const res = {
        status: function(s) {
            this.statusCode = s;
            return this;
        },
        json: function(data) {
            const app = data.data.find(d => d.name === 'Test User Base64');
            if (app) {
                console.log("Found Application!");
                console.log("aadhaarFront:", app.aadhaarFront);
                // Also check if decoded base64 matches original content
                if (app.aadhaarFront && app.aadhaarFront[1]) {
                    const decoded = Buffer.from(app.aadhaarFront[1], 'base64').toString('utf8');
                    console.log("Decoded Content:", decoded);
                }
            } else {
                console.log("Application not found.");
            }
            process.exit(0);
        }
    };

    exportLoanApplications(req, res).catch(err => {
        console.error("Error:", err);
        process.exit(1);
    });
}

runTest();
