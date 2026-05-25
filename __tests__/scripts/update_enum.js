const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Adding new enum values...');
  try {
    await prisma.$executeRawUnsafe(`ALTER TYPE "LoanStatus" ADD VALUE IF NOT EXISTS 'HOLD'`);
    console.log('Added HOLD');
  } catch (e) {
    console.log('Could not add HOLD:', e.message);
  }
  try {
    await prisma.$executeRawUnsafe(`ALTER TYPE "LoanStatus" ADD VALUE IF NOT EXISTS 'IN_PROGRESS'`);
    console.log('Added IN_PROGRESS');
  } catch (e) {
    console.log('Could not add IN_PROGRESS:', e.message);
  }
  try {
    await prisma.$executeRawUnsafe(`ALTER TYPE "LoanStatus" ADD VALUE IF NOT EXISTS 'COMPLETED'`);
    console.log('Added COMPLETED');
  } catch (e) {
    console.log('Could not add COMPLETED:', e.message);
  }
  console.log('Added enum values successfully!');
}

main()
  .catch(e => {
    console.error('Error adding enum values:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
