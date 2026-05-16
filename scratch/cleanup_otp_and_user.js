const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const TARGET_PHONE = '+919875403824';

  // ── 1. Preview what will be deleted ──────────────────────────────────────
  console.log('=== PRE-DELETE CHECK ===\n');

  const allOtps = await prisma.otp.findMany({ orderBy: { id: 'asc' } });
  console.log(`OTP table — total rows: ${allOtps.length}`);
  allOtps.forEach(o => console.log(`  id=${o.id}  phone=${o.phone}  code=${o.code}  verified=${o.verified}`));

  const user = await prisma.user.findUnique({ where: { phone: TARGET_PHONE } });
  if (!user) {
    console.log(`\n⚠️  No user found for ${TARGET_PHONE} — nothing to delete for that account.`);
  } else {
    console.log(`\nUser to delete: id=${user.id}  customId=${user.customUserId}  phone=${user.phone}`);

    const loans        = await prisma.loan.count({ where: { userId: user.id } });
    const apps         = await prisma.loanApplication.count({ where: { userId: user.id } });
    const docs         = await prisma.userDocument.count({ where: { userId: user.id } });
    const losJobs      = await prisma.losIntegrationJob.count({ where: { userId: user.id } });
    console.log(`  → Loans: ${loans}, LoanApplications: ${apps}, Documents: ${docs}, LOS Jobs: ${losJobs}`);
  }

  console.log('\n=== STARTING DELETION ===\n');

  // ── 2. Clear entire OTP table ─────────────────────────────────────────────
  const deletedOtps = await prisma.otp.deleteMany({});
  console.log(`✅ Deleted ${deletedOtps.count} rows from OTP table.`);

  // ── 3. Delete user + all related data for 9875403824 ─────────────────────
  if (user) {
    const uid = user.id;

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
    await prisma.user.delete({ where: { id: uid } });

    console.log(`✅ Deleted user ${TARGET_PHONE} (id=${uid}) and all related records.`);
  }

  // ── 4. Final confirmation ─────────────────────────────────────────────────
  const remainingOtps = await prisma.otp.count();
  const remainingUsers = await prisma.user.count({ where: { role: 'CUSTOMER' } });
  console.log(`\n=== DONE ===`);
  console.log(`Remaining OTP rows: ${remainingOtps}`);
  console.log(`Remaining CUSTOMER accounts: ${remainingUsers}`);
}

main()
  .catch(e => console.error('❌ Error:', e))
  .finally(async () => { await prisma.$disconnect(); });
