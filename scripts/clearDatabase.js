const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearDatabase() {
  console.log("WARNING: This will completely wipe all data from your database.");
  console.log("Starting database cleanup...");

  try {
    // Delete in order to avoid foreign key constraint violations
    console.log("Deleting User Location Data...");
    await prisma.userLocation.deleteMany();

    console.log("Deleting OTPs...");
    await prisma.otp.deleteMany();
    await prisma.otpVerification.deleteMany();

    console.log("Deleting PAN Verifications...");
    await prisma.panVerification.deleteMany();

    console.log("Deleting Aadhaar Verifications...");
    await prisma.aadhaarVerification.deleteMany();

    console.log("Deleting User Documents...");
    await prisma.userDocument.deleteMany();
    await prisma.userDocumentStatus.deleteMany();

    console.log("Deleting LOS Data...");
    await prisma.losIntegrationJob.deleteMany();
    await prisma.losExportLog.deleteMany();

    console.log("Deleting Loans...");
    await prisma.loan.deleteMany();

    console.log("Deleting Loan Applications...");
    await prisma.loanApplication.deleteMany();

    console.log("Deleting Business Information...");
    await prisma.businessDetail.deleteMany();

    console.log("Deleting Employment Information...");
    await prisma.employmentDetail.deleteMany();

    console.log("Deleting Address Information...");
    await prisma.addressDetail.deleteMany();

    console.log("Deleting Attribution Logs...");
    await prisma.attributionLog.deleteMany();

    // Finally, delete the Users
    console.log("Deleting Users...");
    await prisma.user.deleteMany();

    console.log("Database has been completely cleared! Fresh start ready.");
  } catch (error) {
    console.error("Error clearing database:", error);
  } finally {
    await prisma.$disconnect();
  }
}

clearDatabase();
