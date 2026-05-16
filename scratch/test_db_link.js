const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function main() {
  console.log('Testing connection to database...');
  console.log('DATABASE_URL:', process.env.DATABASE_URL.split('@')[1]); // Log safely without password

  try {
    // Attempt to query the database
    const users = await prisma.user.findMany({
      select: { id: true, name: true, phone: true, email: true, role: true }
    });
    console.log('Users in DB:', users);
    
    // Test the enum changes we just pushed
    const applications = await prisma.loanApplication.findMany({
      take: 1,
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true }
    });
    
    if (applications.length > 0) {
      console.log(`Most recent loan application status: ${applications[0].status}`);
    } else {
      console.log('No loan applications found to check status.');
    }
    
  } catch (error) {
    console.error('❌ Connection Failed!');
    console.error(error.message);
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
