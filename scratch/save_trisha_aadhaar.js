const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ⚠️  FILL IN TRISHA'S REAL AADHAAR NUMBER BEFORE RUNNING
const TRISHA_USER_ID = 395;
const TRISHA_REAL_AADHAAR = 'XXXXXXXXXXXX'; // <-- Replace with actual 12-digit number

async function saveTrishaAadhaar() {
  if (TRISHA_REAL_AADHAAR === 'XXXXXXXXXXXX') {
    console.log('❌ Please update TRISHA_REAL_AADHAAR with her real 12-digit Aadhaar number first!');
    return;
  }

  const clean = TRISHA_REAL_AADHAAR.replace(/\D/g, '');
  if (clean.length !== 12) {
    console.log('❌ Aadhaar must be exactly 12 digits.');
    return;
  }

  // Check if already taken by another user
  const conflict = await prisma.aadhaarVerification.findUnique({ where: { aadhaarNumber: clean } });
  if (conflict && conflict.userId !== TRISHA_USER_ID) {
    console.log(`❌ Aadhaar ${clean} is already linked to User ID ${conflict.userId}. Cannot assign.`);
    return;
  }

  const record = await prisma.aadhaarVerification.upsert({
    where: { userId: TRISHA_USER_ID },
    create: { userId: TRISHA_USER_ID, aadhaarNumber: clean, verified: true, verifiedAt: new Date() },
    update: { aadhaarNumber: clean, verified: true, verifiedAt: new Date() }
  });

  console.log('✅ Aadhaar saved for Trisha:', record);
  console.log('She should now appear in the loan viewer app.');
}

saveTrishaAadhaar()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
