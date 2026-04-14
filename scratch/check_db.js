const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://usr_loaninneed_main:rYxuNXtGLPf6vSsDei2DghI4p49zlAsBjJBQ9kH6hrnoVY513HYpFpi@139.59.7.5:5432/postgres?schema=public"
    }
  }
});

async function testConnection() {
  try {
    const result = await prisma.$queryRaw`SELECT datname FROM pg_database;`;
    console.log('✅ Connected to auth/server successfully!');
    console.log('Available databases:');
    result.forEach(row => console.log(' - ' + row.datname));
  } catch (err) {
    console.error('❌ Connection FAILED:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
