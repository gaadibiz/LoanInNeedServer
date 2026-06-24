require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const pansToSearch = ['ALHPR1787K'];
  const aadhaarsToSearch = [];

  console.log(`Searching for PANs: ${pansToSearch.join(', ')}`);

  const userIdsToPurge = new Set();

  // 1. Search PANs
  for (const pan of pansToSearch) {
    const panRecords = await prisma.panVerification.findMany({
      where: { panNumber: { equals: pan, mode: 'insensitive' } },
      include: { user: true }
    });
    if (panRecords.length > 0) {
      console.log(`\nFound PAN "${pan}":`);
      panRecords.forEach(r => {
        console.log(`  - User ID: ${r.userId} | Name: ${r.user?.name} | Phone: ${r.user?.phone}`);
        userIdsToPurge.add(r.userId);
      });
    } else {
      console.log(`\nNo record found for PAN "${pan}".`);
    }
  }

  const userIds = Array.from(userIdsToPurge);

  if (userIds.length === 0) {
    console.log(`\nNo users found attached to this PAN number. It may have already been deleted.`);
    return;
  }

  console.log(`\n========================================`);
  console.log(`Initiating full data purge for User IDs: ${userIds.join(', ')}...`);

  // Get phones for OTP deletion
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { phone: true }
  });
  const phones = users.map(u => u.phone).filter(Boolean);

  // 1. losIntegrationJob (references loanApplication and user)
  await prisma.losIntegrationJob.deleteMany({ where: { userId: { in: userIds } } });
  
  // 2. loanApplication and loan
  await prisma.loanApplication.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.loan.deleteMany({ where: { userId: { in: userIds } } });
  
  // 3. User Documents
  await prisma.userDocument.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.userDocumentStatus.deleteMany({ where: { userId: { in: userIds } } });
  
  // 4. KYC & Location
  await prisma.userLocation.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.addressDetail.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.employmentDetail.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.panVerification.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.aadhaarVerification.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.businessDetail.deleteMany({ where: { userId: { in: userIds } } });
  
  // 5. Auth & Logging
  await prisma.otpVerification.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.attributionLog.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.partnerStatus.deleteMany({ where: { userId: { in: userIds } } });
  if (phones.length > 0) {
    await prisma.otp.deleteMany({ where: { phone: { in: phones } } });
  }

  // 6. Finally delete the users themselves
  const deletedUsers = await prisma.user.deleteMany({
    where: {
      id: { in: userIds }
    }
  });

  console.log(`✅ Successfully purged ${deletedUsers.count} user account(s) and all associated PAN data!`);
}

main()
  .catch(e => {
    console.error('Error during cleanup:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
