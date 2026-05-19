const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function investigate() {
  const aadhaarNumber = '909247578142';

  // Find who owns this Aadhaar
  const existing = await prisma.aadhaarVerification.findUnique({
    where: { aadhaarNumber },
    include: { user: true }
  });

  if (existing) {
    console.log('⚠️  Aadhaar 909247578142 is already linked to:');
    console.log(`  User ID: ${existing.userId}`);
    console.log(`  Name: ${existing.user?.name}`);
    console.log(`  Phone: ${existing.user?.phone}`);
    console.log(`  Verified: ${existing.verified}`);
  } else {
    console.log('Aadhaar not found in DB.');
  }

  // Check Trisha (395) — what can we do
  const trisha = await prisma.user.findUnique({
    where: { id: 395 },
    include: { aadhaarVerification: true, loanApplications: true, panVerification: true }
  });

  console.log('\n=== TRISHA (ID 395) ===');
  console.log(`Name: ${trisha.name}`);
  console.log(`PAN: ${trisha.panVerification?.panNumber || 'None'}`);
  console.log(`Aadhaar: ${trisha.aadhaarVerification?.aadhaarNumber || 'None'}`);
  console.log(`Loan Apps: ${trisha.loanApplications.length}`);
  
  // Check if Trisha is the same person as the existing Aadhaar holder
  if (existing && existing.userId === 395) {
    console.log('✅ That Aadhaar is already linked to Trisha!');
  } else if (existing) {
    console.log('\n❓ This Aadhaar belongs to a different user. Possible duplicate account?');
    console.log('Options: 1) Use a different Aadhaar, 2) Move Aadhaar to Trisha if it\'s her data');
  }
}

investigate()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
