const prisma = require('../utils/prismaClient');
const { buildFinnauxJobPayload } = require('../services/finnauxIntegrationService');

async function fillFinnauxIntegrationJobs() {
  try {
    const applications = await prisma.loanApplication.findMany({
      where: { finnauxIntegrationJob: null },
      select: { id: true, userId: true, ipAddress: true }
    });

    console.log(`Found ${applications.length} LoanApplication(s) without a FinnauxIntegrationJob.`);

    let created = 0;
    let failed = 0;

    for (const application of applications) {
      try {
        const rawRequest = await buildFinnauxJobPayload(application.userId, application.id, application.ipAddress);

        await prisma.finnauxIntegrationJob.create({
          data: {
            userId: application.userId,
            applicationId: application.id,
            ipAddress: application.ipAddress,
            status: 'PENDING',
            rawRequest: JSON.parse(JSON.stringify(rawRequest))
          }
        });

        created++;
      } catch (err) {
        failed++;
        console.error(`Failed to create FinnauxIntegrationJob for Application ${application.id} (User ${application.userId}): ${err.message}`);
      }
    }

    console.log(`Done. Created: ${created}, failed: ${failed}, total considered: ${applications.length}.`);
  } catch (err) {
    console.error('Error filling FinnauxIntegrationJob rows:', err);
  } finally {
    await prisma.$disconnect();
  }
}

fillFinnauxIntegrationJobs();
