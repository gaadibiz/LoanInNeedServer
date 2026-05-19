const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixUser391() {
  const userId = 391;

  // Check if Aadhaar record already exists
  const existing = await prisma.aadhaarVerification.findUnique({ where: { userId } });

  if (existing) {
    console.log('Aadhaar record already exists:', existing);
    return;
  }

  // Create Aadhaar record as manually verified (admin override)
  const record = await prisma.aadhaarVerification.create({
    data: {
      userId,
      aadhaarNumber: 'PENDING_COLLECTION', // Placeholder — admin should collect real number
      verified: false, // Not marking as verified since we don't have the real number
      verifiedAt: null
    }
  });

  console.log('✅ Aadhaar placeholder created:', record);
  console.log('⚠️  NOTE: Real Aadhaar number still needs to be collected from the customer.');
}

fixUser391()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
