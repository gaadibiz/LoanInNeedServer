const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const USER_IDS_TO_DELETE = [48, 49, 50, 51, 52, 53];

async function deleteById(userId) {
    try {
        const user = await prisma.user.findUnique({ where: { id: userId } });

        if (!user) {
            console.log(`No user found with ID: ${userId} — skipping.`);
            return;
        }

        console.log(`Deleting user ID ${userId} (${user.name || 'Unknown'}, ${user.phone})...`);

        // Delete all dependencies first
        await prisma.panVerification.deleteMany({ where: { userId } });
        await prisma.aadhaarVerification.deleteMany({ where: { userId } });
        await prisma.employmentDetail.deleteMany({ where: { userId } });
        await prisma.addressDetail.deleteMany({ where: { userId } });
        await prisma.userDocument.deleteMany({ where: { userId } });
        await prisma.userDocumentStatus.deleteMany({ where: { userId } });
        await prisma.userLocation.deleteMany({ where: { userId } });
        await prisma.losIntegrationJob.deleteMany({ where: { userId } });
        await prisma.attributionLog.deleteMany({ where: { userId } });
        await prisma.otpVerification.deleteMany({ where: { userId } });
        await prisma.partnerStatus.deleteMany({ where: { userId } });
        await prisma.businessDetail.deleteMany({ where: { userId } });

        // Delete loan applications (with LOS jobs already cleared)
        await prisma.loanApplication.deleteMany({ where: { userId } });
        await prisma.loan.deleteMany({ where: { userId } });

        // Delete OTPs for this phone
        await prisma.otp.deleteMany({ where: { phone: user.phone } });

        // Finally delete the user
        await prisma.user.delete({ where: { id: userId } });

        console.log(`✅ Successfully deleted user ID ${userId}.`);

    } catch (e) {
        console.error(`❌ Error deleting user ID ${userId}:`, e.message);
    }
}

async function main() {
    console.log(`Starting deletion of user IDs: ${USER_IDS_TO_DELETE.join(', ')}\n`);
    for (const id of USER_IDS_TO_DELETE) {
        await deleteById(id);
    }
    await prisma.$disconnect();
    console.log('\nDone.');
}

main();
