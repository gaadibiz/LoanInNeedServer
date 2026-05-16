const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteByPhone(phone) {
    try {
        console.log(`Searching for user with phone: ${phone}`);
        const user = await prisma.user.findUnique({
            where: { phone: phone },
            include: {
                loanApplications: true
            }
        });

        if (!user) {
            console.log(`No user found with phone: ${phone}`);
            
            // Still try to delete OTP
            await prisma.otp.deleteMany({ where: { phone } });
            console.log(`Cleared OTPs for ${phone} just in case.`);
            return;
        }

        const userId = user.id;
        console.log(`Starting deletion process for user: ${user.name || 'Unknown'} (ID: ${userId})`);

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

        await prisma.loan.deleteMany({ where: { userId } });
        
        // Finally, delete the user
        await prisma.user.delete({ where: { id: userId } });
        
        // Also delete OTP record for this phone if exists
        await prisma.otp.deleteMany({ where: { phone } });

        console.log(`Successfully deleted user ID ${userId} and all dependencies.`);

    } catch (e) {
        console.error("Error deleting user:", e);
    } finally {
        await prisma.$disconnect();
    }
}

deleteByPhone("+919830918171");
