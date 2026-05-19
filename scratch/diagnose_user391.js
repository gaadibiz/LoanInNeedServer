const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function diagnoseUser() {
  // Find by name or phone
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { phone: '+917478937758' },
        { id: 391 }
      ]
    },
    include: {
      panVerification: true,
      aadhaarVerification: true,
      loanApplications: {
        orderBy: { createdAt: 'desc' }
      },
      employment: true,
      documents: true
    }
  });

  if (!user) {
    console.log('❌ User not found!');
    return;
  }

  console.log('=== USER RECORD ===');
  console.log(`ID: ${user.id}, customUserId: ${user.customUserId}`);
  console.log(`Name: ${user.name}`);
  console.log(`Phone: ${user.phone}`);
  console.log(`Email: ${user.email}`);

  console.log('\n=== PAN VERIFICATION ===');
  if (user.panVerification) {
    console.log(`PAN Number: ${user.panVerification.panNumber}`);
    console.log(`Verified: ${user.panVerification.verified}`);
  } else {
    console.log('❌ No PAN record found');
  }

  console.log('\n=== AADHAAR VERIFICATION ===');
  if (user.aadhaarVerification) {
    console.log(`Aadhaar Number: ${user.aadhaarVerification.aadhaarNumber}`);
    console.log(`Verified: ${user.aadhaarVerification.verified}`);
  } else {
    console.log('❌ No Aadhaar record found');
  }

  console.log('\n=== LOAN APPLICATIONS ===');
  console.log(`Count: ${user.loanApplications.length}`);
  user.loanApplications.forEach(app => {
    console.log(`  App ID: ${app.id}, Amount: ${app.loanAmount}, Status: ${app.status}, Created: ${app.createdAt}`);
  });

  console.log('\n=== EXPORT FILTER CHECK ===');
  const hasName = !!(user.name && user.name.trim().split(' ').length >= 2);
  const hasPan = !!(user.panVerification && user.panVerification.panNumber);
  const hasAadhaar = !!(user.aadhaarVerification && user.aadhaarVerification.aadhaarNumber);
  const hasLoanApp = user.loanApplications.length > 0;

  console.log(`✅ Name OK: ${hasName} (name="${user.name}")`);
  console.log(`${hasPan ? '✅' : '❌'} PAN OK: ${hasPan}`);
  console.log(`${hasAadhaar ? '✅' : '❌'} Aadhaar OK: ${hasAadhaar}`);
  console.log(`${hasLoanApp ? '✅' : '❌'} Has Loan Application: ${hasLoanApp}`);

  if (!hasName || !hasPan || !hasAadhaar) {
    console.log('\n⚠️  This user is EXCLUDED from the export because of missing fields above.');
  } else if (!hasLoanApp) {
    console.log('\n⚠️  User has all KYC but NO LoanApplication record — they won\'t appear in the viewer.');
  } else {
    console.log('\n✅ User should appear in export. Check the loan viewer query.');
  }
}

diagnoseUser()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
