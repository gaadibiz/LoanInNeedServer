require('dotenv').config();
const prisma = require('./utils/prismaClient');
const { processSingleJob } = require('./services/losIntegrationService');

async function main() {
  console.log("Finding Biswanath Manna's LOS Integration Job...");
  const user = await prisma.user.findFirst({
    where: {
      name: {
        contains: 'BISWANATH',
        mode: 'insensitive'
      }
    },
    include: {
      losIntegrationJobs: true
    }
  });

  if (!user || !user.losIntegrationJobs || user.losIntegrationJobs.length === 0) {
    console.error("Could not find user or LosIntegrationJob");
    return;
  }

  const job = user.losIntegrationJobs[0];
  console.log(`Found Job ID: ${job.id} for User: ${user.name} (ID: ${user.id}). Current Status: ${job.status}`);

  console.log("Manually triggering processSingleJob to push KYC documents...");
  await processSingleJob(job);
  console.log("✅ Documents successfully pushed to LOS!");
}

main()
  .catch(e => {
    console.error("Error pushing documents:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
