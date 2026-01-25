const { createPartner, getPartnerProfile, updatePartnerProfile } = require('../services/partnerService');
const prisma = require('../utils/prismaClient');

async function main() {
    console.log('--- STARTING PARTNER LOGIC VERIFICATION ---');

    const testPhone = '+919999999999';
    const testRole = 'DSA';

    try {
        // 1. Cleanup
        console.log('Cleaning up old test user...');
        const oldUser = await prisma.user.findUnique({ where: { phone: testPhone } });
        if (oldUser) {
            // Delete related records first due to foreign keys if cascade not set
            // or just delete user if cascade is set. Assuming default or manual cleanup
            await prisma.partnerStatus.deleteMany({ where: { userId: oldUser.id } });
            await prisma.businessDetail.deleteMany({ where: { userId: oldUser.id } });
            await prisma.addressDetail.deleteMany({ where: { userId: oldUser.id } });
            await prisma.panVerification.deleteMany({ where: { userId: oldUser.id } });
            await prisma.user.delete({ where: { id: oldUser.id } });
            console.log('Cleanup done.');
        }

        // 2. Create Partner
        console.log(`\n1. Creating Partner (${testRole})...`);
        const created = await createPartner({
            phone: testPhone,
            role: testRole,
            name: 'Test Partner',
            email: 'partner@test.com'
        });
        console.log('Partner Created:', created.user.id);

        const userId = parseInt(created.user.id.replace('LIN', '')); // Extract ID from custom ID logic? 
        // Wait, logic uses customUserId but returns user object. 
        // Let's get the real numeric ID from DB based on phone
        const dbUser = await prisma.user.findUnique({ where: { phone: testPhone } });
        const realUserId = dbUser.id;

        // 3. Update Profile (Individual)
        console.log('\n2. Updating Profile (Individual)...');
        await updatePartnerProfile(realUserId, {
            profileType: 'INDIVIDUAL',
            address: {
                currentAddress: '123 Test St',
                city: 'Test City',
                state: 'Test State',
                pincode: '123456'
            },
            panNumber: 'ABCDE1234F'
        });
        console.log('Profile Updated (Individual)');

        // 4. Verify Individual Data
        let profile = await getPartnerProfile(realUserId);
        console.log('Profile fetched:', profile.profileType, profile.address?.city);

        // 5. Update Profile (Firm)
        console.log('\n3. Updating Profile (Firm)...');
        await updatePartnerProfile(realUserId, {
            profileType: 'FIRM',
            business: {
                firmName: 'Test Firm',
                gstNumber: '29ABCDE1234F1Z5',
                address: 'Business Park',
                city: 'Biz City'
            }
        });
        console.log('Profile Updated (Firm)');

        // 6. Verify Firm Data
        profile = await getPartnerProfile(realUserId);
        console.log('Profile fetched:', profile.profileType, profile.business?.firmName);

        console.log('\n--- VERIFICATION SUCCESS ---');

    } catch (error) {
        console.error('\n❌ VERIFICATION FAILED:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
