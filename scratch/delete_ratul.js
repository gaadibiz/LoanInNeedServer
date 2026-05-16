const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Searching for user "Ratul Das"...');

  // Find users with name Ratul Das
  const usersToDelete = await prisma.user.findMany({
    where: {
      name: {
        equals: 'Ratul Das',
        mode: 'insensitive'
      }
    },
    select: { id: true, name: true, phone: true }
  });

  if (usersToDelete.length === 0) {
    console.log('No user found with the name "Ratul Das".');
    return;
  }

  const userIds = usersToDelete.map(u => u.id);

  console.log(`Found ${userIds.length} user(s) named "Ratul Das". IDs: ${userIds.join(', ')}`);
  console.log(`Deleting data for these users...`);

  // 3. Delete all related records
  // We must delete LosIntegrationJob first since it references LoanApplication
  await prisma.losIntegrationJob.deleteMany({ where: { userId: { in: userIds } } });
  
  // Loan applications and Loans
  await prisma.loanApplication.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.loan.deleteMany({ where: { userId: { in: userIds } } });
  
  // User Documents
  await prisma.userDocument.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.userDocumentStatus.deleteMany({ where: { userId: { in: userIds } } });
  
  // KYC & Location
  await prisma.userLocation.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.addressDetail.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.employmentDetail.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.panVerification.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.aadhaarVerification.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.businessDetail.deleteMany({ where: { userId: { in: userIds } } });
  
  // Auth & Logging
  await prisma.otpVerification.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.attributionLog.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.partnerStatus.deleteMany({ where: { userId: { in: userIds } } });

  // 4. Finally delete the users themselves
  const deletedUsers = await prisma.user.deleteMany({
    where: {
      id: { in: userIds }
    }
  });

  console.log(`Successfully deleted ${deletedUsers.count} user(s) named "Ratul Das" and all their associated data.`);
}

main()
  .catch(e => {
    console.error('Error during cleanup:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
