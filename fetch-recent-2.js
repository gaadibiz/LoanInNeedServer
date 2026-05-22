const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const users = await prisma.user.findMany({
    orderBy: { id: 'desc' },
    take: 5,
    select: { id: true, name: true, phoneVerified: true, dob: true, createdAt: true, customUserId: true }
  });
  console.log("USERS:", JSON.stringify(users, null, 2));

  const apps = await prisma.loanApplication.findMany({
    orderBy: { id: 'desc' },
    take: 5,
    select: { id: true, userId: true, loanAmount: true, createdAt: true }
  });
  console.log("APPS:", JSON.stringify(apps, null, 2));
}

run().catch(console.error).finally(() => prisma.$disconnect());
