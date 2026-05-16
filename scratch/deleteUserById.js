const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteUser(userId) {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                loanApplications: true
            }
        });

        if (!user) {
            console.log("User not found.");
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

        console.log("Successfully deleted user and all dependencies.");

    } catch (e) {
        console.error("Error deleting user:", e);
    } finally {
        await prisma.$disconnect();
    }
}

deleteUser(3);
