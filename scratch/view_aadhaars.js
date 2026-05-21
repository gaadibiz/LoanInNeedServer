const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const verifications = await prisma.aadhaarVerification.findMany({
    take: 5
  });
  console.log("Aadhaar Verifications:", verifications);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
