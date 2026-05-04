const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Starting DB cleanup...');

  try {
    // 1. Delete all application/user related records
    await prisma.losIntegrationJob.deleteMany({});
    await prisma.loanApplication.deleteMany({});
    await prisma.loan.deleteMany({});
    
    await prisma.userDocument.deleteMany({});
    await prisma.userLocation.deleteMany({});
    await prisma.userDocumentStatus.deleteMany({});
    
    await prisma.addressDetail.deleteMany({});
    await prisma.employmentDetail.deleteMany({});
    await prisma.businessDetail.deleteMany({});
    
    await prisma.panVerification.deleteMany({});
    await prisma.aadhaarVerification.deleteMany({});
    
    await prisma.otpVerification.deleteMany({});
    await prisma.otp.deleteMany({});
    
    await prisma.partnerStatus.deleteMany({});
    await prisma.attributionLog.deleteMany({});
    
    // 2. Delete all users who are not SUPER_ADMIN
    const deletedUsers = await prisma.user.deleteMany({
      where: {
        role: {
          not: 'SUPER_ADMIN'
        }
      }
    });

    console.log('Deleted Users:', deletedUsers.count);
    
    console.log('Database successfully cleaned, except SUPER_ADMINs.');
  } catch (err) {
    console.error('Error cleaning database:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
