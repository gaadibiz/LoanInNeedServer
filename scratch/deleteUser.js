const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteUser() {
  const aadhaarNumber = '909247578142';
  const aadhaarRecord = await prisma.aadhaarVerification.findUnique({
    where: { aadhaarNumber }
  });

  if (!aadhaarRecord) {
    console.log('No such Aadhaar record found');
    return;
  }

  const userId = aadhaarRecord.userId;
  console.log('Found user with ID:', userId);

  try {
    await prisma.$transaction([
      prisma.aadhaarVerification.deleteMany({ where: { userId } }),
      prisma.panVerification.deleteMany({ where: { userId } }),
      prisma.addressDetail.deleteMany({ where: { userId } }),
      prisma.businessDetail.deleteMany({ where: { userId } }),
      prisma.partnerStatus.deleteMany({ where: { userId } }),
      prisma.userDocumentStatus.deleteMany({ where: { userId } }),
      prisma.losIntegrationJob.deleteMany({ where: { userId } }),
      prisma.userLocation.deleteMany({ where: { userId } }),
      prisma.userDocument.deleteMany({ where: { userId } }),
      prisma.loanApplication.deleteMany({ where: { userId } }),
      prisma.employmentDetail.deleteMany({ where: { userId } }),
      prisma.loan.deleteMany({ where: { userId } }),
      prisma.otpVerification.deleteMany({ where: { userId } }),
      prisma.attributionLog.deleteMany({ where: { userId } }),
      prisma.user.delete({ where: { id: userId } })
    ]);
    console.log('Successfully deleted user and all related records');
  } catch (error) {
    console.error('Error during deletion transaction:', error);
  }
}

deleteUser()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
