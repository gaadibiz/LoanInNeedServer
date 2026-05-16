const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== PRE-WIPE CHECK ===\n');

  // Show who will be KEPT
  const admins = await prisma.user.findMany({
    where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] } },
    select: { id: true, phone: true, email: true, name: true, role: true, customUserId: true }
  });
  console.log(`✅ KEEPING ${admins.length} admin account(s):`);
  admins.forEach(a => console.log(`   id=${a.id}  ${a.customUserId}  ${a.role}  ${a.phone || a.email || a.name}`));

  // Show what will be DELETED
  const customers = await prisma.user.findMany({
    where: { role: { notIn: ['SUPER_ADMIN', 'ADMIN'] } },
    select: { id: true, phone: true, customUserId: true, role: true }
  });
  console.log(`\n🗑️  DELETING ${customers.length} non-admin account(s):`);
  customers.forEach(u => console.log(`   id=${u.id}  ${u.customUserId}  ${u.role}  ${u.phone}`));

  const otpCount    = await prisma.otp.count();
  const loanCount   = await prisma.loan.count();
  const appCount    = await prisma.loanApplication.count();
  const docCount    = await prisma.userDocument.count();
  const losCount    = await prisma.losIntegrationJob.count();

  console.log(`\n   OTP records: ${otpCount}`);
  console.log(`   Loans: ${loanCount}`);
  console.log(`   Loan Applications: ${appCount}`);
  console.log(`   Documents: ${docCount}`);
  console.log(`   LOS Jobs: ${losCount}`);

  if (customers.length === 0 && otpCount === 0) {
    console.log('\n✅ Database already clean. Nothing to delete.');
    return;
  }

  console.log('\n=== STARTING WIPE ===\n');

  const adminIds = admins.map(a => a.id);

  // Delete all OTPs (none belong to admins)
  const d_otp = await prisma.otp.deleteMany({});
  console.log(`✅ Cleared OTP table: ${d_otp.count} rows`);

  // Delete customer-only related tables (excluding admin userIds)
  const d_los  = await prisma.losIntegrationJob.deleteMany({ where: { userId: { notIn: adminIds } } });
  console.log(`✅ LOS jobs deleted: ${d_los.count}`);

  const d_apps = await prisma.loanApplication.deleteMany({ where: { userId: { notIn: adminIds } } });
  console.log(`✅ Loan Applications deleted: ${d_apps.count}`);

  const d_loans = await prisma.loan.deleteMany({ where: { userId: { notIn: adminIds } } });
  console.log(`✅ Loans deleted: ${d_loans.count}`);

  const d_emp  = await prisma.employmentDetail.deleteMany({ where: { userId: { notIn: adminIds } } });
  console.log(`✅ Employment details deleted: ${d_emp.count}`);

  const d_biz  = await prisma.businessDetail.deleteMany({ where: { userId: { notIn: adminIds } } });
  console.log(`✅ Business details deleted: ${d_biz.count}`);

  const d_aadh = await prisma.aadhaarVerification.deleteMany({ where: { userId: { notIn: adminIds } } });
  console.log(`✅ Aadhaar verifications deleted: ${d_aadh.count}`);

  const d_pan  = await prisma.panVerification.deleteMany({ where: { userId: { notIn: adminIds } } });
  console.log(`✅ PAN verifications deleted: ${d_pan.count}`);

  const d_addr = await prisma.addressDetail.deleteMany({ where: { userId: { notIn: adminIds } } });
  console.log(`✅ Address details deleted: ${d_addr.count}`);

  const d_otpv = await prisma.otpVerification.deleteMany({ where: { userId: { notIn: adminIds } } });
  console.log(`✅ OTP Verifications deleted: ${d_otpv.count}`);

  const d_docs = await prisma.userDocument.deleteMany({ where: { userId: { notIn: adminIds } } });
  console.log(`✅ User Documents deleted: ${d_docs.count}`);

  const d_dsts = await prisma.userDocumentStatus.deleteMany({ where: { userId: { notIn: adminIds } } });
  console.log(`✅ Document Status records deleted: ${d_dsts.count}`);

  const d_locs = await prisma.userLocation.deleteMany({ where: { userId: { notIn: adminIds } } });
  console.log(`✅ User Locations deleted: ${d_locs.count}`);

  const d_psts = await prisma.partnerStatus.deleteMany({ where: { userId: { notIn: adminIds } } });
  console.log(`✅ Partner Statuses deleted: ${d_psts.count}`);

  const d_attr = await prisma.attributionLog.deleteMany({ where: { userId: { notIn: adminIds } } });
  console.log(`✅ Attribution logs deleted: ${d_attr.count}`);

  const d_users = await prisma.user.deleteMany({ where: { role: { notIn: ['SUPER_ADMIN', 'ADMIN'] } } });
  console.log(`✅ Users deleted: ${d_users.count}`);

  // Final state
  console.log('\n=== FINAL STATE ===');
  const remaining = await prisma.user.findMany({ select: { id: true, phone: true, role: true, customUserId: true } });
  console.log(`Remaining accounts: ${remaining.length}`);
  remaining.forEach(u => console.log(`  id=${u.id}  ${u.customUserId}  ${u.role}  ${u.phone}`));
  console.log('\n✅ Database wipe complete.');
}

main()
  .catch(e => console.error('❌ Error:', e))
  .finally(async () => { await prisma.$disconnect(); });
