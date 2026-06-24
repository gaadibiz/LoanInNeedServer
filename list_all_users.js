require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Fetching all users along with PAN and Aadhaar records...");
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      phone: true,
      panVerification: {
        select: { panNumber: true }
      },
      aadhaarVerification: {
        select: { aadhaarNumber: true }
      }
    },
    orderBy: { id: 'asc' }
  });

  console.log(`\nFound ${users.length} users in total.\n`);
  console.log("================================================================================");
  console.log(JSON.stringify(users, null, 2));
  console.log("================================================================================");
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
