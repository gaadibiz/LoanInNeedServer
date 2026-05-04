const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Starting database cleanup...');

  // 1. Find all SUPER_ADMINs to keep (keep only the very first one, or all of them? "keeping only one superadmin")
  const superAdmins = await prisma.user.findMany({
    where: { role: 'SUPER_ADMIN' },
    orderBy: { id: 'asc' }
  });

  const superAdminToKeep = superAdmins.length > 0 ? superAdmins[0].id : -1;
  if (superAdminToKeep === -1) {
    console.warn('No SUPER_ADMIN found! Proceeding to delete all other users anyway...');
  } else {
    console.log(`Keeping SUPER_ADMIN user ID: ${superAdminToKeep} (${superAdmins[0].email || superAdmins[0].phone})`);
  }

  // 2. Find all users EXCEPT the one super admin
  const usersToDelete = await prisma.user.findMany({
    where: {
      id: {
        not: superAdminToKeep
      }
    },
    select: { id: true }
  });

  const userIds = usersToDelete.map(u => u.id);

  if (userIds.length === 0) {
    console.log('No users to delete.');
    return;
  }

  console.log(`Deleting data for ${userIds.length} users...`);

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

  // Delete all global OTPs as well
  await prisma.otp.deleteMany();

  // 4. Finally delete the users themselves
  const deletedUsers = await prisma.user.deleteMany({
    where: {
      id: { in: userIds }
    }
  });

  console.log(`Successfully deleted ${deletedUsers.count} users and all their associated data.`);
  console.log('Database cleanup complete! Only one SUPER_ADMIN remains.');
}

main()
  .catch(e => {
    console.error('Error during cleanup:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
