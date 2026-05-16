const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteByName(nameStr) {
    try {
        console.log(`Searching for User with name containing: ${nameStr}`);
        const users = await prisma.user.findMany({
            where: {
                name: {
                    contains: nameStr
                }
            },
            include: {
                loanApplications: true
            }
        });

        if (!users || users.length === 0) {
            console.log(`No user found with name containing: ${nameStr}`);
            return;
        }

        for (const user of users) {
            const userId = user.id;
            console.log(`Found User ID: ${userId} for name: ${user.name} (Phone: ${user.phone})`);

            console.log(`Starting deletion process for user: ${user.name}...`);

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

            console.log(`Successfully deleted all data for user ${user.name}.`);
        }

    } catch (e) {
        console.error("Error deleting user:", e);
    } finally {
        await prisma.$disconnect();
    }
}

deleteByName("Priyanshu Routh");
