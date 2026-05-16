const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Fetching last 15 OTP records...');
  const lastOtps = await prisma.otp.findMany({
    orderBy: { createdAt: 'desc' },
    take: 15
  });

  if (lastOtps.length > 0) {
    const otpIds = lastOtps.map(o => o.id);
    await prisma.otp.deleteMany({
      where: { id: { in: otpIds } }
    });
    console.log(`Deleted ${otpIds.length} OTP records.`);
  } else {
    console.log('No OTP records found.');
  }

  console.log('Fetching last 15 User records...');
  const lastUsers = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: 15
  });

  if (lastUsers.length > 0) {
    const userIds = lastUsers.map(u => u.id);
    console.log(`Found ${userIds.length} users to delete:`, userIds);

    // Delete related records manually to respect foreign key constraints
    
    // LosIntegrationJob
    await prisma.losIntegrationJob.deleteMany({ where: { userId: { in: userIds } } });
    
    // LoanApplication
    await prisma.loanApplication.deleteMany({ where: { userId: { in: userIds } } });
    
    // Loan
    await prisma.loan.deleteMany({ where: { userId: { in: userIds } } });
    
    // EmploymentDetail
    await prisma.employmentDetail.deleteMany({ where: { userId: { in: userIds } } });
    
    // BusinessDetail
    await prisma.businessDetail.deleteMany({ where: { userId: { in: userIds } } });
    
    // AadhaarVerification
    await prisma.aadhaarVerification.deleteMany({ where: { userId: { in: userIds } } });
    
    // PanVerification
    await prisma.panVerification.deleteMany({ where: { userId: { in: userIds } } });
    
    // AddressDetail
    await prisma.addressDetail.deleteMany({ where: { userId: { in: userIds } } });
    
    // OtpVerification
    await prisma.otpVerification.deleteMany({ where: { userId: { in: userIds } } });
    
    // UserDocument
    await prisma.userDocument.deleteMany({ where: { userId: { in: userIds } } });
    
    // UserDocumentStatus
    await prisma.userDocumentStatus.deleteMany({ where: { userId: { in: userIds } } });
    
    // UserLocation
    await prisma.userLocation.deleteMany({ where: { userId: { in: userIds } } });
    
    // PartnerStatus
    await prisma.partnerStatus.deleteMany({ where: { userId: { in: userIds } } });
    
    // AttributionLog
    await prisma.attributionLog.deleteMany({ where: { userId: { in: userIds } } });

    // Finally, delete the users
    await prisma.user.deleteMany({
      where: { id: { in: userIds } }
    });
    console.log(`Deleted ${userIds.length} User records and all related data.`);
  } else {
    console.log('No User records found.');
  }

  console.log('Database cleanup completed successfully.');
}

main()
  .catch(e => console.error('Error during cleanup:', e))
  .finally(async () => {
    await prisma.$disconnect();
  });
