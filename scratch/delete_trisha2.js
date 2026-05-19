const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteTrishaIfExists() {
  // Find any user named Trisha
  const trishas = await prisma.user.findMany({
    where: { name: { contains: 'TRISHA', mode: 'insensitive' } },
    select: { id: true, name: true, phone: true }
  });

  if (trishas.length === 0) {
    console.log('ℹ️  No user named Trisha found in the database.');
    return;
  }

  for (const t of trishas) {
    const uid = t.id;
    console.log(`\n🗑️  Deleting User ID ${uid} (${t.name}, ${t.phone})...`);

    await prisma.losIntegrationJob.deleteMany({ where: { userId: uid } });
    await prisma.loanApplication.deleteMany({ where: { userId: uid } });
    await prisma.loan.deleteMany({ where: { userId: uid } });
    await prisma.userDocument.deleteMany({ where: { userId: uid } });
    await prisma.userLocation.deleteMany({ where: { userId: uid } });
    await prisma.otpVerification.deleteMany({ where: { userId: uid } });
    await prisma.attributionLog.deleteMany({ where: { userId: uid } });

    try { await prisma.panVerification.delete({ where: { userId: uid } }); } catch {}
    try { await prisma.aadhaarVerification.delete({ where: { userId: uid } }); } catch {}
    try { await prisma.employmentDetail.delete({ where: { userId: uid } }); } catch {}
    try { await prisma.addressDetail.delete({ where: { userId: uid } }); } catch {}
    try { await prisma.userDocumentStatus.delete({ where: { userId: uid } }); } catch {}
    try { await prisma.businessDetail.delete({ where: { userId: uid } }); } catch {}
    try { await prisma.partnerStatus.delete({ where: { userId: uid } }); } catch {}

    await prisma.user.delete({ where: { id: uid } });
    console.log(`  ✅ User ID ${uid} (${t.name}) fully deleted.`);
  }
}

deleteTrishaIfExists()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
