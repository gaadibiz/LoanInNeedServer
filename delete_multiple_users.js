require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const namesToDelete = [
    'Ratul das',
    'Trisha Roy chowdhury',
    'priyanshu Routh',
    'Ashis Singh',
    'Parimal bhushan Routh',
    'Mahua Routh'
  ];

  console.log(`Searching for users matching: ${namesToDelete.join(', ')}...`);

  for (const nameStr of namesToDelete) {
    console.log(`\n========================================`);
    console.log(`Searching for User containing: "${nameStr}"`);
    const users = await prisma.user.findMany({
      where: {
        name: {
          contains: nameStr,
          mode: 'insensitive'
        }
      },
      select: { id: true, name: true, phone: true }
    });

    if (users.length === 0) {
      console.log(`No user found matching "${nameStr}".`);
      continue;
    }

    const userIds = users.map(u => u.id);
    const phones = users.map(u => u.phone).filter(Boolean);

    console.log(`Found ${userIds.length} user(s) matching "${nameStr}":`);
    users.forEach(u => console.log(`  - ID: ${u.id} | Name: ${u.name} | Phone: ${u.phone}`));
    console.log(`Deleting all associated data...`);

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

    console.log(`✅ Successfully deleted ${deletedUsers.count} user(s) matching "${nameStr}" and all their associated data.`);
  }
}

main()
  .catch(e => {
    console.error('Error during cleanup:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
