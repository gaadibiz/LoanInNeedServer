const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Checking LosIntegrationJob for MALAY's applications...");
  const applicationIds = [1845, 1878, 1879];
  
  const jobs = await prisma.losIntegrationJob.findMany({
    where: {
      applicationId: {
        in: applicationIds
      }
    }
  });
  
  console.log("LosIntegrationJobs:", JSON.stringify(jobs, null, 2));

  // Let's also check if they uploaded documents
  const docs = await prisma.userDocument.findMany({
    where: {
      userId: 12644
    }
  });

  console.log("UserDocuments for User 12644:", docs.length > 0 ? "Present" : "None");
}

main()
  .catch(e => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
