const { exportLoanApplications } = require('../controllers/loanController');
const prisma = require('../utils/prismaClient');

async function runTest() {
    console.log("Starting filter test...");
    
    const timestamp = Date.now().toString().slice(-5);
    
    // Create User 1: Incomplete (Missing PAN & Aadhaar)
    const userIncomplete = await prisma.user.create({
        data: {
            phone: `11111${timestamp}`,
            name: 'Incomplete User', // Has name but no PAN/Aadhaar
            loanApplications: {
                create: { loanAmount: 5000, loanType: 'OTHER' }
            }
        }
    });

    // Create User 2: Complete
    const userComplete = await prisma.user.create({
        data: {
            phone: `22222${timestamp}`,
            name: 'Complete User',
            panVerification: {
                create: { panNumber: `ABCDE${timestamp}F`, verified: true }
            },
            aadhaarVerification: {
                create: { aadhaarNumber: `12341234${timestamp}`, verified: true }
            },
            documents: {
                create: [
                    { docType: 'AADHAAR', filePath: 'uploads/Documents/AADHAAR/test.jpg', fileName: 'test.jpg' },
                    { docType: 'PAN', filePath: 'uploads/Documents/PAN/test.jpg', fileName: 'test.jpg' },
                    { docType: 'PAY_SLIP', filePath: 'uploads/Documents/PAY_SLIP/test.jpg', fileName: 'test.jpg' },
                    { docType: 'BANK_STATEMENT', filePath: 'uploads/Documents/BANK_STATEMENT/test.jpg', fileName: 'test.jpg' }
                ]
            },
            loanApplications: {
                create: { loanAmount: 15000, loanType: 'OTHER' }
            }
        }
    });
    
    // Create User 3: Blank Name
    const userBlank = await prisma.user.create({
        data: {
            phone: `33333${timestamp}`,
            name: null,
            panVerification: {
                create: { panNumber: `XXCDE${timestamp}F`, verified: true }
            },
            aadhaarVerification: {
                create: { aadhaarNumber: `00001234${timestamp}`, verified: true }
            },
            loanApplications: {
                create: { loanAmount: 20000, loanType: 'OTHER' }
            }
        }
    });
    
    // Create User 4: Only First Name (1 word)
    const userOneWord = await prisma.user.create({
        data: {
            phone: `44444${timestamp}`,
            name: 'John',
            panVerification: {
                create: { panNumber: `YYCDE${timestamp}F`, verified: true }
            },
            aadhaarVerification: {
                create: { aadhaarNumber: `11111234${timestamp}`, verified: true }
            },
            loanApplications: {
                create: { loanAmount: 20000, loanType: 'OTHER' }
            }
        }
    });


    // Call export endpoint
    const req = {
        query: { from: '2020-01-01', to: '2030-12-31' }
    };

    const res = {
        status: function(s) {
            this.statusCode = s;
            return this;
        },
        json: function(data) {
            const apps = data.data;
            const foundIncomplete = apps.find(app => app.name === 'Incomplete User');
            const foundComplete = apps.find(app => app.name === 'Complete User');
            const foundBlank = apps.find(app => app.mobileNo === userBlank.phone);
            const foundOneWord = apps.find(app => app.name === 'John');
            
            console.log("Incomplete User Exported?", !!foundIncomplete); // Expect false
            console.log("Complete User Exported?", !!foundComplete); // Expect true
            console.log("Blank Name User Exported?", !!foundBlank); // Expect false
            console.log("One Word Name User Exported?", !!foundOneWord); // Expect false
            
            if (!foundIncomplete && foundComplete && !foundBlank && !foundOneWord) {
                console.log("SUCCESS: Filter is working perfectly!");
            } else {
                console.log("FAILED: Filter is not working as expected.");
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
