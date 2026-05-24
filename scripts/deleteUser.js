const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteUser() {
  try {
    const phoneToFind = '+919875403824';
    const user = await prisma.user.findFirst({ where: { phone: phoneToFind } });
    
    if (!user) {
      console.log(`User with phone ${phoneToFind} not found.`);
      process.exit(0);
    }

    const userId = user.id;
    console.log(`Found User ID: ${userId} for phone ${phoneToFind}`);

    // Delete in correct order to avoid foreign key constraints
    console.log('Deleting UserDocuments...');
    await prisma.userDocument.deleteMany({ where: { userId } });
    
    console.log('Deleting UserLocations...');
    await prisma.userLocation.deleteMany({ where: { userId } });
    
    console.log('Deleting OtpVerifications...');
    await prisma.otpVerification.deleteMany({ where: { userId } });
    
    console.log('Deleting Otps...');
    await prisma.otp.deleteMany({ where: { phone: phoneToFind } });
    
    console.log('Deleting AadhaarVerifications...');
    await prisma.aadhaarVerification.deleteMany({ where: { userId } });
    
    console.log('Deleting PanVerifications...');
    await prisma.panVerification.deleteMany({ where: { userId } });
    
    console.log('Deleting AddressDetails...');
    await prisma.addressDetail.deleteMany({ where: { userId } });
    
    // Application and Employment are linked
    console.log('Deleting LosIntegrationJobs...');
    await prisma.losIntegrationJob.deleteMany({ where: { application: { userId } } });
    
    console.log('Deleting LoanApplications...');
    await prisma.loanApplication.deleteMany({ where: { userId } });
    
    console.log('Deleting EmploymentDetails...');
    await prisma.employmentDetail.deleteMany({ where: { userId } });
    
    console.log('Deleting Loans...');
    await prisma.loan.deleteMany({ where: { userId } });
    
    console.log('Deleting AuditLogs...');
    await prisma.auditLog.deleteMany({ where: { userId } });

    // Finally delete the user
    console.log('Deleting User record...');
    await prisma.user.delete({ where: { id: userId } });

    console.log('User and all associated data deleted successfully!');
  } catch (err) {
    console.error('Error deleting data:', err);
  } finally {
    await prisma.$disconnect();
  }
}

deleteUser();
