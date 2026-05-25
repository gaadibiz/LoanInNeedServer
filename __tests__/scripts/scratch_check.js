const { PrismaClient } = require('./Backend/node_modules/@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      phoneNumber: true,
      loanApplications: {
        select: {
          id: true,
          loanStatus: true
        }
      }
    }
  });
  console.log('All Users:');
  console.log(JSON.stringify(users, null, 2));
}

check().catch(console.error).finally(() => prisma.$disconnect());
