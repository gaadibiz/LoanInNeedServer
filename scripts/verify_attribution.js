const prisma = require('../utils/prismaClient');
const { createPartner, generateReferralLink } = require('../services/partnerService');
const { applyForLoan } = require('../controllers/loanController');
const attributionMiddleware = require('../middleware/attributionMiddleware');

// Mock Request/Response
const mockReq = (query, user, session = {}) => ({
    query,
    user,
    attribution: session,
    body: { loanAmount: 50000, loanType: 'BUSINESS', purposeOfLoan: 'Expansion' },
    ip: '127.0.0.1'
});
const mockRes = () => {
    const res = {};
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (data) => { res.body = data; return res; };
    return res;
};
const mockNext = () => { };

async function main() {
    console.log('--- VERIFYING SECURE ATTRIBUTION ---');

    // 1. Setup Partner
    const testPhone = '+918888888888';
    await prisma.attributionLog.deleteMany();
    await prisma.loanApplication.deleteMany();
    await prisma.user.deleteMany({ where: { phone: testPhone } });
    // Also delete the Customer user we'll create
    await prisma.user.deleteMany({ where: { email: 'customer@test.com' } });

    console.log('Creating Partner...');
    const partner = await createPartner({
        phone: testPhone,
        role: 'DSA',
        name: 'Attribution DSA',
        email: 'dsa@test.com'
    });
    const partnerId = parseInt(partner.user.id.replace('LIN', '')); // Assuming numeric ID matches offset or retrieval logic. 
    // Wait, partnerService returns customUserId. We need real ID.
    const dbPartner = await prisma.user.findUnique({ where: { phone: testPhone } });

    // 2. Generate Link
    console.log('Generating Link...');
    const linkResult = await generateReferralLink(dbPartner.id);
    console.log('Link:', linkResult.link);
    const urlParams = new URLSearchParams(linkResult.link.split('?')[1]);
    const query = Object.fromEntries(urlParams);

    // 3. Simulate Middleware Check (Valid)
    console.log('\nTesting Middleware (Valid Link)...');
    const req = mockReq(query, null);
    await attributionMiddleware(req, {}, mockNext);

    if (req.attribution && req.attribution.partnerId === dbPartner.id) {
        console.log('✅ Middleware attributed correctly:', req.attribution);
    } else {
        console.error('❌ Middleware failed to attribute.');
    }

    // 4. Simulate Middleware Check (Tampered)
    console.log('\nTesting Middleware (Tampered Link)...');
    const tamperedQuery = { ...query, pid: '999999' }; // Change PID
    const tamperedReq = mockReq(tamperedQuery, null);
    await attributionMiddleware(tamperedReq, {}, mockNext);
    if (!tamperedReq.attribution) {
        console.log('✅ Tampered link rejected.');
    } else {
        console.error('❌ Tampered link accepted!', tamperedReq.attribution);
    }

    // 5. Create User & Check Locked Attribution
    console.log('\nTesting Loan Application (Organic -> Linked)...');
    // Create a customer
    const customer = await prisma.user.create({
        data: {
            phone: '+917777777777',
            email: 'customer@test.com',
            role: 'CUSTOMER'
        }
    });

    // Simulate Loan Apply with Session Attribution from Step 3
    const loanReq = mockReq({}, { id: customer.id }, req.attribution);
    const loanRes = mockRes();

    // Mock the handler being called
    await applyForLoan(loanReq, loanRes);
    console.log('Loan Response:', loanRes.body);

    // Verify User Lock
    const dbCustomer = await prisma.user.findUnique({ where: { id: customer.id } });
    if (dbCustomer.attributedPartnerId === dbPartner.id) {
        console.log('✅ User correctly locked to partner:', dbCustomer.attributedPartnerId);
    } else {
        console.error('❌ User lock failed:', dbCustomer.attributedPartnerId);
    }

    // 6. Verify Log
    const logs = await prisma.attributionLog.findMany();
    console.log('\nAttribution Logs:', logs.length);
    logs.forEach(l => console.log(`- ${l.action} (Partner: ${l.partnerId})`));

    console.log('\n--- VERIFICATION FINISHED ---');
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
