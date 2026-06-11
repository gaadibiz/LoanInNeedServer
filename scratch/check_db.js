const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const count = await prisma.loanApplication.count();
  console.log('Total loan applications:', count);
}
main().catch(console.error).finally(() => prisma.$disconnect());
