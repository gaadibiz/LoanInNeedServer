const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testExport() {
  const users = await prisma.user.findMany({
    include: {
      panVerification: true,
      aadhaarVerification: true,
      loanApplications: true
    },
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  for (const user of users) {
    console.log(`User ID: ${user.id}, Name: ${user.name}, Phone: ${user.phone}`);
    console.log(`PAN: ${user.panVerification?.panNumber || 'None'}`);
    console.log(`Aadhaar: ${user.aadhaarVerification?.aadhaarNumber || 'None'}`);
    console.log(`Loan Apps: ${user.loanApplications.length}`);
    
    // Check if it passes the filter
    const panVerification = user.panVerification;
    const aadhaarVerification = user.aadhaarVerification;
    
    let isComplete = true;
    let reason = [];
    
    if (!user || !user.name) {
      isComplete = false;
      reason.push("Missing name");
    } else {
      const nameParts = user.name.trim().split(' ');
      if (nameParts.length < 2) {
        isComplete = false;
        reason.push("Name has < 2 parts");
      }
    }
    
    if (!panVerification || !panVerification.panNumber) {
      isComplete = false;
      reason.push("Missing PAN");
    }
    if (!aadhaarVerification || !aadhaarVerification.aadhaarNumber) {
      isComplete = false;
      reason.push("Missing Aadhaar");
    }
    
    console.log(`Is Complete for LOS: ${isComplete} ${!isComplete ? '(' + reason.join(', ') + ')' : ''}`);
    console.log('-----------------------------------');
  }
}

testExport()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
