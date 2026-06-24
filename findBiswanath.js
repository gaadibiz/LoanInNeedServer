const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Checking for 'BISWANATH' in the database...");
  
  const users = await prisma.user.findMany({
    where: {
      name: {
        contains: 'BISWANATH',
        mode: 'insensitive',
      }
    },
    include: {
      loanApplications: {
        include: {
          losIntegrationJob: true
        }
      },
      losIntegrationJobs: true,
      documents: true,
      aadhaarVerification: true,
      panVerification: true,
      address: true,
      employment: true,
      business: true
    }
  });
  
  console.log("Users named BISWANATH:", JSON.stringify(users, null, 2));
}

main()
  .catch(e => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
