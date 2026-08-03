const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function backfillFinnauxLoanApplicationId() {
  try {
    const jobs = await prisma.finnauxIntegrationJob.findMany({
      where: { rawRequest: { not: null } },
      select: { id: true, applicationId: true, rawRequest: true }
    });

    console.log(`Found ${jobs.length} FinnauxIntegrationJob row(s) with a rawRequest payload.`);

    let updated = 0;
    let skipped = 0;

    for (const job of jobs) {
      if (job.rawRequest.loanApplicationId === job.applicationId) {
        skipped++;
        continue;
      }

      await prisma.finnauxIntegrationJob.update({
        where: { id: job.id },
        data: {
          rawRequest: {
            ...job.rawRequest,
            loanApplicationId: job.applicationId
          }
        }
      });
      updated++;
    }

    console.log(`Backfill complete. Updated: ${updated}, already up to date: ${skipped}.`);
  } catch (err) {
    console.error('Error backfilling loanApplicationId into FinnauxIntegrationJob.rawRequest:', err);
  } finally {
    await prisma.$disconnect();
  }
}

backfillFinnauxLoanApplicationId();
