const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearOtpTables() {
  try {
    const deletedOtps = await prisma.otp.deleteMany({});
    console.log(`Deleted ${deletedOtps.count} records from Otp table.`);
    
    try {
        const deletedOtpVerifications = await prisma.otpVerification.deleteMany({});
        console.log(`Deleted ${deletedOtpVerifications.count} records from OtpVerification table.`);
    } catch (e) {
        // Table might not be actively used or have relations
        console.log("Could not clear OtpVerification table:", e.message);
    }
  } catch (error) {
    console.error('Error clearing OTP tables:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearOtpTables();
