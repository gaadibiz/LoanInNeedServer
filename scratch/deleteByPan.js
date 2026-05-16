const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteByPan(panNumber) {
    try {
        console.log(`Searching for PAN: ${panNumber}`);
        const panRecord = await prisma.panVerification.findUnique({
            where: { panNumber: panNumber }
        });

        if (!panRecord) {
            console.log(`No PAN verification record found for PAN: ${panNumber}`);
            return;
        }

        const userId = panRecord.userId;
        console.log(`Found User ID: ${userId} for PAN: ${panNumber}`);

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                loanApplications: true
            }
        });

        if (!user) {
            console.log("User not found... weird.");
            return;
        }

        console.log(`Starting deletion process for user: ${user.name} (Phone: ${user.phone})`);

        // Delete dependencies
        await prisma.panVerification.deleteMany({ where: { userId } });
        await prisma.aadhaarVerification.deleteMany({ where: { userId } });
        await prisma.employmentDetail.deleteMany({ where: { userId } });
        await prisma.addressDetail.deleteMany({ where: { userId } });
        await prisma.userDocument.deleteMany({ where: { userId } });
        await prisma.userDocumentStatus.deleteMany({ where: { userId } });
        await prisma.userLocation.deleteMany({ where: { userId } });
        await prisma.losIntegrationJob.deleteMany({ where: { userId } });
        await prisma.attributionLog.deleteMany({ where: { userId } });
        
        // delete loan applications
        for (const app of user.loanApplications) {
            await prisma.loanApplication.delete({ where: { id: app.id } });
        }
        
        // Finally, delete the user
        await prisma.user.delete({ where: { id: userId } });
        
        // Also delete OTP record for this phone if exists
        await prisma.otp.deleteMany({ where: { phone: user.phone } });

        console.log("Successfully deleted all user data associated with this PAN.");

    } catch (e) {
        console.error("Error deleting user:", e);
    } finally {
        await prisma.$disconnect();
    }
}

deleteByPan("PFRPS2061Q");
