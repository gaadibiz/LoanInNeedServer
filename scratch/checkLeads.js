const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkLeads() {
  try {
    console.log("Checking for 'Amit Kumar Verma' and 'Nitika'...");

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: 'Amit', mode: 'insensitive' } },
          { name: { contains: 'Nitika', mode: 'insensitive' } }
        ]
      },
      include: {
        loanApplications: {
          include: {
            losIntegrationJob: true
          }
        },
        documents: {
          select: {
            id: true,
            docType: true,
            status: true,
            fileName: true
          }
        }
      }
    });

    console.log(`Found ${users.length} users matching the criteria.\n`);

    users.forEach(user => {
      console.log('--------------------------------------------------');
      console.log(`User ID: ${user.id} | Name: ${user.name} | Phone: ${user.phone}`);
      console.log(`Documents Count: ${user.documents.length}`);
      console.log(`Applications: ${user.loanApplications.length}`);
      
      user.loanApplications.forEach(app => {
        console.log(`  -> App ID: ${app.id} | Status: ${app.status} | LOS App No: ${app.losApplicationNumber || 'N/A'}`);
        if (app.losIntegrationJob) {
          const job = app.losIntegrationJob;
          console.log(`     -> LOS Job ID: ${job.id} | Status: ${job.status} | RetryCount: ${job.retryCount}`);
          console.log(`     -> LOS App ID: ${job.losApplicationId} | LOS Case No: ${job.losCaseNumber}`);
        } else {
          console.log(`     -> No LOS Integration Job found.`);
        }
      });
      console.log('--------------------------------------------------');
    });

  } catch (error) {
    console.error('Error querying database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkLeads();
