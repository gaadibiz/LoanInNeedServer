const { exportLoanApplications } = require('./controllers/loanController');
const prisma = require('./utils/prismaClient');
const fs = require('fs');
const path = require('path');

async function runTest() {
    // For S3 testing, we don't need a local file. We will use a known uploaded file from DO Spaces.
    const relativePath = 'Documents/AADHAAR/9999/1779557820532_test_dummy.txt';
    const s3Url = 'https://bumchum.sfo3.digitaloceanspaces.com/Documents/AADHAAR/9999/1779557820532_test_dummy.txt';

    // 2. Insert dummy User, Document, and LoanApplication
    const user = await prisma.user.create({
        data: {
            phone: `99999${Date.now().toString().slice(-5)}`,
            name: 'Test User Base64',
            panVerification: {
                create: { panNumber: `PAN${Date.now().toString().slice(-6)}`, verified: true }
            },
            aadhaarVerification: {
                create: { aadhaarNumber: `AADHAAR${Date.now().toString().slice(-5)}`, verified: true }
            },
            documents: {
                create: [
                    {
                        docType: 'AADHAAR',
                        filePath: relativePath,
                        fileUrl: s3Url,
                        fileName: 'test_dummy.txt'
                    },
                    {
                        docType: 'PAN',
                        filePath: relativePath,
                        fileUrl: s3Url,
                        fileName: 'test_dummy.txt'
                    },
                    {
                        docType: 'BANK_STATEMENT',
                        filePath: relativePath,
                        fileUrl: s3Url,
                        fileName: 'test_dummy.txt'
                    },
                    {
                        docType: 'PAY_SLIP',
                        filePath: relativePath,
                        fileUrl: s3Url,
                        fileName: 'test_dummy.txt'
                    }
                ]
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
                if (app.aadhaarFront && app.aadhaarFront[0]) {
                    const decoded = Buffer.from(app.aadhaarFront[0], 'base64').toString('utf8');
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
