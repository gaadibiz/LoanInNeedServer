const { updateLoanStatusFromLos } = require('./Backend/controllers/loanController');
const prisma = require('./Backend/utils/prismaClient');

async function runTest() {
    console.log('--- STARTING LOS UPDATE STATUS INTEGRATION TESTS ---');

    const timestamp = Date.now().toString().slice(-5);
    const phone = `88888${timestamp}`;

    // 1. Create a dummy user and a loan application
    const user = await prisma.user.create({
        data: {
            phone,
            name: 'LOS Test User',
            loanApplications: {
                create: {
                    loanAmount: 25000,
                    loanType: 'BUSINESS'
                }
            }
        },
        include: {
            loanApplications: true
        }
    });

    const application = user.loanApplications[0];
    console.log(`Created test User with ID ${user.id} and LoanApplication with ID ${application.id}`);

    // Helper to invoke updateLoanStatusFromLos
    const testUpdate = async (payload) => {
        let result = null;
        let caughtError = null;

        const req = { body: payload };
        const res = {
            status: function(code) {
                this.statusCode = code;
                return this;
            },
            json: function(data) {
                result = { statusCode: this.statusCode, data };
            }
        };
        const next = (err) => {
            caughtError = err;
        };

        try {
            await updateLoanStatusFromLos(req, res, next);
        } catch (e) {
            caughtError = e;
        }

        return { result, error: caughtError };
    };

    try {
        // Test 1: Invalid status value
        console.log('\n--- Test 1: Invalid status value ---');
        const res1 = await testUpdate({
            id: application.id,
            status: 'INVALID_STATUS',
            employeeId: 'EMP1',
            employeeName: 'John Admin'
        });
        if (res1.error && res1.error.message.includes('Invalid status value')) {
            console.log('✔ Test 1 Passed: Correctly threw validation error for invalid status.');
        } else {
            console.log('❌ Test 1 Failed:', res1.error || res1.result);
        }

        // Test 2: Status is REJECTED but reason is missing
        console.log('\n--- Test 2: Status REJECTED with missing reason ---');
        const res2 = await testUpdate({
            id: application.id,
            status: 'REJECTED',
            employeeId: 'EMP1',
            employeeName: 'John Admin'
        });
        if (res2.error && res2.error.message.includes('Reason is required when status is REJECTED')) {
            console.log('✔ Test 2 Passed: Correctly threw validation error for missing rejection reason.');
        } else {
            console.log('❌ Test 2 Failed:', res2.error || res2.result);
        }

        // Test 3: Status is REJECTED with a valid reason
        console.log('\n--- Test 3: Status REJECTED with valid reason ---');
        const res3 = await testUpdate({
            id: application.id,
            status: 'REJECTED',
            reason: 'Credit score too low',
            employeeId: 'EMP1',
            employeeName: 'John Admin'
        });
        if (!res3.error && res3.result && res3.result.statusCode === 200) {
            console.log('✔ Test 3 Passed: Successfully rejected the application with reason.');
            const dbApp = await prisma.loanApplication.findUnique({ where: { id: application.id } });
            console.log(`  Verification - DB Status: ${dbApp.status}, Reason: "${dbApp.reason}"`);
        } else {
            console.log('❌ Test 3 Failed:', res3.error || res3.result);
        }

        // Test 4: Status is APPROVED
        console.log('\n--- Test 4: Status APPROVED ---');
        const res4 = await testUpdate({
            id: application.id,
            status: 'APPROVED',
            employeeId: 'EMP1',
            employeeName: 'John Admin',
            loanNo: 'LOAN123456',
            applicationNumber: 'LOS999'
        });
        if (!res4.error && res4.result && res4.result.statusCode === 200) {
            console.log('✔ Test 4 Passed: Successfully approved the application.');
            const dbApp = await prisma.loanApplication.findUnique({ where: { id: application.id } });
            console.log(`  Verification - DB Status: ${dbApp.status}, LoanNo: "${dbApp.loanAccountNumber}", AppNo: "${dbApp.losApplicationNumber}"`);
        } else {
            console.log('❌ Test 4 Failed:', res4.error || res4.result);
        }

    } finally {
        // Cleanup
        console.log('\n--- Cleaning up test records ---');
        await prisma.loanApplication.deleteMany({ where: { userId: user.id } });
        await prisma.user.delete({ where: { id: user.id } });
        console.log('Cleanup completed successfully.');
    }
}

runTest().catch(console.error);
