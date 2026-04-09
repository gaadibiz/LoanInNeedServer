const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const jobs = await prisma.losIntegrationJob.findMany({
    orderBy: { createdAt: 'desc' },
    take: 1
  });

  if (jobs.length > 0) {
    console.log(JSON.stringify(jobs[0].rawRequest, null, 2));
  } else {
    console.log("No jobs found");
  }
}
main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
