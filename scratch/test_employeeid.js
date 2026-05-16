const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function main() {
  console.log('Testing LoanApplication query to check if employeeId exists...');
  try {
    const apps = await prisma.loanApplication.findMany({
      select: { id: true, employeeId: true }
    });
    console.log('✅ Query succeeded. `employeeId` column exists.');
  } catch (err) {
    console.error('❌ Query failed:', err.message);
  }
}

main().finally(async () => {
  await prisma.$disconnect();
});
