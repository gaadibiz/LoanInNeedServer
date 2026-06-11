const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Checking for 'MALAY' in the database...");
  
  const users = await prisma.user.findMany({
    where: {
      name: {
        contains: 'MALAY',
        mode: 'insensitive',
      }
    },
    include: {
      loanApplications: true
    }
  });
  
  const loanAppsByEmployee = await prisma.loanApplication.findMany({
    where: {
      employeeName: {
        contains: 'MALAY',
        mode: 'insensitive',
      }
    },
    include: {
      user: true
    }
  });

  const businesses = await prisma.businessDetail.findMany({
    where: {
      firmName: {
        contains: 'MALAY',
        mode: 'insensitive'
      }
    },
    include: {
      user: true
    }
  });
  
  console.log("Users named MALAY:", JSON.stringify(users, null, 2));
  console.log("Loan Applications with employeeName MALAY:", JSON.stringify(loanAppsByEmployee, null, 2));
  console.log("Businesses named MALAY:", JSON.stringify(businesses, null, 2));
}

main()
  .catch(e => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
