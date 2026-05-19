const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function diagnoseAndFix() {
  // --- FIND TRISHA ROY CHOWDHURY ---
  const trisha = await prisma.user.findFirst({
    where: {
      name: { contains: 'TRISHA', mode: 'insensitive' }
    },
    include: {
      panVerification: true,
      aadhaarVerification: true,
      loanApplications: { orderBy: { createdAt: 'desc' } }
    }
  });

  if (!trisha) {
    console.log('❌ Trisha Roy Chowdhury not found by name. Listing all users with name containing "ROY"...');
    const users = await prisma.user.findMany({
      where: { name: { contains: 'ROY', mode: 'insensitive' } },
      select: { id: true, name: true, phone: true }
    });
    console.log(users);
    return;
  }

  console.log('=== TRISHA ROY CHOWDHURY ===');
  console.log(`ID: ${trisha.id}, Name: ${trisha.name}, Phone: ${trisha.phone}`);
  console.log(`PAN: ${trisha.panVerification?.panNumber || '❌ None'}`);
  console.log(`Aadhaar: ${trisha.aadhaarVerification?.aadhaarNumber || '❌ None'}`);
  console.log(`Loan Apps: ${trisha.loanApplications.length}`);

  // --- FIX TRISHA: Save real Aadhaar ---
  const trishaAadhaar = '909247578142'; // From the image provided
  if (!trisha.aadhaarVerification) {
    await prisma.aadhaarVerification.create({
      data: {
        userId: trisha.id,
        aadhaarNumber: trishaAadhaar,
        verified: true,
        verifiedAt: new Date()
      }
    });
    console.log(`✅ Aadhaar ${trishaAadhaar} saved for Trisha.`);
  } else if (trisha.aadhaarVerification.aadhaarNumber !== trishaAadhaar) {
    await prisma.aadhaarVerification.update({
      where: { userId: trisha.id },
      data: { aadhaarNumber: trishaAadhaar, verified: true, verifiedAt: new Date() }
    });
    console.log(`✅ Aadhaar updated to ${trishaAadhaar} for Trisha.`);
  } else {
    console.log('ℹ️  Trisha Aadhaar already set correctly.');
  }

  // --- FIX USER 391 (PAREKH VED HEMANTKUMAR) with placeholder ---
  const ved = await prisma.user.findUnique({
    where: { id: 391 },
    include: { aadhaarVerification: true }
  });

  if (ved) {
    console.log('\n=== PAREKH VED HEMANTKUMAR (ID 391) ===');
    if (!ved.aadhaarVerification) {
      // Create placeholder — admin must collect real number later
      await prisma.aadhaarVerification.create({
        data: {
          userId: 391,
          aadhaarNumber: 'PENDING',
          verified: false,
          verifiedAt: null
        }
      });
      console.log('⚠️  Placeholder Aadhaar created for VED (PENDING). Real number must be collected.');
    } else if (ved.aadhaarVerification.aadhaarNumber === 'PENDING_COLLECTION') {
      await prisma.aadhaarVerification.update({
        where: { userId: 391 },
        data: { aadhaarNumber: 'PENDING' }
      });
      console.log('⚠️  Updated placeholder to PENDING.');
    } else {
      console.log(`ℹ️  VED Aadhaar: ${ved.aadhaarVerification.aadhaarNumber}`);
    }
  }

  console.log('\n✅ Done. Re-run the loan viewer to verify both users now appear.');
}

diagnoseAndFix()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
