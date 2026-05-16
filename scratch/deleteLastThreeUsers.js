const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteLastThreeUsers() {
    try {
        console.log("Fetching last 3 users...");
        const latestUsers = await prisma.user.findMany({
            take: 3,
            orderBy: {
                id: 'desc'
            },
            include: {
                loanApplications: true
            }
        });

        if (latestUsers.length === 0) {
            console.log("No users found in the database.");
            return;
        }

        for (const user of latestUsers) {
            const userId = user.id;
            console.log(`\nStarting deletion process for user: ${user.name || 'Unknown'} (ID: ${userId}, Phone: ${user.phone})`);

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
            await prisma.otp.deleteMany({ where: { phone: user.phone } });

            console.log(`Successfully deleted user ID ${userId} and all dependencies.`);
        }

    } catch (e) {
        console.error("Error deleting users:", e);
    } finally {
        await prisma.$disconnect();
    }
}

deleteLastThreeUsers();
