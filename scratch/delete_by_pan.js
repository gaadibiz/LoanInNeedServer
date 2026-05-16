const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TARGET_PANS = ['HCXPD3815G', 'GVIPD2597G', 'CNQPC3790J', 'FHCPRO884R'];

async function deleteUser(uid, phone) {
  await prisma.losIntegrationJob.deleteMany({ where: { userId: uid } });
  await prisma.loanApplication.deleteMany({ where: { userId: uid } });
  await prisma.loan.deleteMany({ where: { userId: uid } });
  await prisma.employmentDetail.deleteMany({ where: { userId: uid } });
  await prisma.businessDetail.deleteMany({ where: { userId: uid } });
  await prisma.aadhaarVerification.deleteMany({ where: { userId: uid } });
  await prisma.panVerification.deleteMany({ where: { userId: uid } });
  await prisma.addressDetail.deleteMany({ where: { userId: uid } });
  await prisma.otpVerification.deleteMany({ where: { userId: uid } });
  await prisma.userDocument.deleteMany({ where: { userId: uid } });
  await prisma.userDocumentStatus.deleteMany({ where: { userId: uid } });
  await prisma.userLocation.deleteMany({ where: { userId: uid } });
  await prisma.partnerStatus.deleteMany({ where: { userId: uid } });
  await prisma.attributionLog.deleteMany({ where: { userId: uid } });
  // Also clear OTPs by phone from the Otp table
  if (phone) {
    await prisma.otp.deleteMany({ where: { phone } });
  }
  await prisma.user.delete({ where: { id: uid } });
}

async function main() {
  console.log('=== PRE-DELETE CHECK ===\n');

  const panRecords = await prisma.panVerification.findMany({
    where: { panNumber: { in: TARGET_PANS } },
    include: { user: true }
  });

  if (panRecords.length === 0) {
    console.log('No PAN records found for the given PAN numbers. Nothing to delete.');
    return;
  }

  for (const pan of panRecords) {
    const u = pan.user;
    const loans   = await prisma.loan.count({ where: { userId: u.id } });
    const apps    = await prisma.loanApplication.count({ where: { userId: u.id } });
    const docs    = await prisma.userDocument.count({ where: { userId: u.id } });
    console.log(`PAN: ${pan.panNumber}  →  User id=${u.id}  customId=${u.customUserId}  phone=${u.phone}`);
    console.log(`   Loans: ${loans}  Applications: ${apps}  Documents: ${docs}`);
  }

  console.log('\n=== STARTING DELETION ===\n');

  for (const pan of panRecords) {
    const u = pan.user;
    await deleteUser(u.id, u.phone);
    console.log(`✅ Deleted PAN ${pan.panNumber}  →  User ${u.phone} (id=${u.id} / ${u.customUserId})`);
  }

  const remaining = await prisma.user.count({ where: { role: 'CUSTOMER' } });
  console.log(`\n=== DONE ===`);
  console.log(`Remaining CUSTOMER accounts: ${remaining}`);
}

main()
  .catch(e => console.error('❌ Error:', e))
  .finally(async () => { await prisma.$disconnect(); });
