const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteUser() {
  const panNumbers = ['GVIPD2597G', 'CNQPC3790J'];
  const aadhaarNumbers = ['423669789343', '909247578142'];

  for (const panNumber of panNumbers) {
    const panRecord = await prisma.panVerification.findUnique({
      where: { panNumber }
    });

    if (panRecord) {
      const userId = panRecord.userId;
      console.log(`Found user with ID: ${userId} via PAN ${panNumber}`);
      await deleteUserById(userId);
    } else {
      console.log(`No PAN record found for ${panNumber}`);
    }
  }

  for (const aadhaarNumber of aadhaarNumbers) {
    const aadhaarRecord = await prisma.aadhaarVerification.findUnique({
      where: { aadhaarNumber }
    });

    if (aadhaarRecord) {
      const userId = aadhaarRecord.userId;
      console.log(`Found user with ID: ${userId} via Aadhaar ${aadhaarNumber}`);
      await deleteUserById(userId);
    } else {
      console.log(`No Aadhaar record found for ${aadhaarNumber}`);
    }
  }
}

async function deleteUserById(userId) {
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
    console.log(`Successfully deleted user ${userId} and all related records`);
  } catch (error) {
    console.error(`Error during deletion transaction for user ${userId}:`, error.message);
  }
}

deleteUser()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
