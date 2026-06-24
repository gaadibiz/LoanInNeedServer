require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Looking up Biswanath Manna's LOS integration job...");
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
    console.error("No job found for Biswanath Manna.");
    return;
  }

  const job = user.losIntegrationJobs[0];
  console.log(`Found Job ID ${job.id}. Current status: ${job.status}`);

  console.log("Updating job status to PENDING so the live production worker picks it up...");
  await prisma.losIntegrationJob.update({
    where: { id: job.id },
    data: {
      status: 'PENDING',
      lastError: null
    }
  });

  console.log("✅ Job successfully reset to PENDING!");
  console.log("The live production server's background worker will now pick it up within 60 seconds and push the documents.");
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
