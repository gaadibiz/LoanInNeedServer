// Quick DB connectivity test script
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testConnection() {
  try {
    const result = await prisma.$queryRaw`SELECT current_database() as db, current_user as usr, version() as ver`;
    console.log('✅ DB Connected successfully!');
    console.log('  Database:', result[0].db);
    console.log('  User    :', result[0].usr);
    console.log('  Version :', result[0].ver.split(',')[0]);
  } catch (err) {
    console.error('❌ Connection FAILED:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
