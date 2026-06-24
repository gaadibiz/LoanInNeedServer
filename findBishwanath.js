const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Checking for 'Bishwanath' in the database...");
  
  const users = await prisma.user.findMany({
    where: {
      name: {
        contains: 'Bishwanath',
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
  
  console.log("Users named Bishwanath:", JSON.stringify(users, null, 2));
}

main()
  .catch(e => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
