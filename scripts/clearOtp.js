const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.otp.deleteMany({});
  console.log(`Successfully deleted ${result.count} OTP records from the 'Otp' table.`);
}

main()
  .catch((e) => {
    console.error('Error clearing OTP table:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
