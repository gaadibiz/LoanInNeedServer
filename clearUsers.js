const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearUsers() {
  try {
    console.log("Starting DB cleanup for users...");
    
    // We want to delete normal customers
    const usersToDelete = await prisma.user.findMany({
      where: {
        role: 'CUSTOMER'
      },
      select: { id: true }
    });
    
    const userIds = usersToDelete.map(u => u.id);
    
    if (userIds.length === 0) {
      console.log("No CUSTOMER users to delete.");
      return;
    }
    
    console.log(`Found ${userIds.length} users to delete. Deleting related records...`);
    
    // Delete related records
    await prisma.losIntegrationJob.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.losExportLog.deleteMany({}); // Optional: clear export logs
    await prisma.userDocument.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.loanApplication.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.loan.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.addressDetail.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.employmentDetail.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.panVerification.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.aadhaarVerification.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.userLocation.deleteMany({ where: { userId: { in: userIds } } });
    
    // Finally delete the users
    const deletedUsers = await prisma.user.deleteMany({
      where: {
        id: { in: userIds }
      }
    });
    
    console.log(`Successfully deleted ${deletedUsers.count} users and all their associated data.`);
  } catch (error) {
    console.error("Error clearing users:", error);
  } finally {
    await prisma.$disconnect();
  }
}

clearUsers();
