const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TRISHA_USER_ID = 395;

async function deleteTrisha() {
  console.log(`🗑️  Deleting all data for User ID ${TRISHA_USER_ID} (TRISHA ROY CHOUDHURY)...`);

  // Delete in dependency order (children first, then parent)

  // 1. LOS Integration Jobs (references LoanApplication)
  const losJobs = await prisma.losIntegrationJob.deleteMany({ where: { userId: TRISHA_USER_ID } });
  console.log(`  ✅ LOS Integration Jobs: ${losJobs.count} deleted`);

  // 2. Loan Applications
  const loanApps = await prisma.loanApplication.deleteMany({ where: { userId: TRISHA_USER_ID } });
  console.log(`  ✅ Loan Applications: ${loanApps.count} deleted`);

  // 3. Loans
  const loans = await prisma.loan.deleteMany({ where: { userId: TRISHA_USER_ID } });
  console.log(`  ✅ Loans: ${loans.count} deleted`);

  // 4. Documents
  const docs = await prisma.userDocument.deleteMany({ where: { userId: TRISHA_USER_ID } });
  console.log(`  ✅ Documents: ${docs.count} deleted`);

  // 5. Locations
  const locs = await prisma.userLocation.deleteMany({ where: { userId: TRISHA_USER_ID } });
  console.log(`  ✅ Locations: ${locs.count} deleted`);

  // 6. OTP Verifications
  const otpV = await prisma.otpVerification.deleteMany({ where: { userId: TRISHA_USER_ID } });
  console.log(`  ✅ OTP Verifications: ${otpV.count} deleted`);

  // 7. PAN Verification
  try {
    await prisma.panVerification.delete({ where: { userId: TRISHA_USER_ID } });
    console.log(`  ✅ PAN Verification: deleted`);
  } catch { console.log(`  ℹ️  PAN Verification: none found`); }

  // 8. Aadhaar Verification
  try {
    await prisma.aadhaarVerification.delete({ where: { userId: TRISHA_USER_ID } });
    console.log(`  ✅ Aadhaar Verification: deleted`);
  } catch { console.log(`  ℹ️  Aadhaar Verification: none found`); }

  // 9. Employment Detail
  try {
    await prisma.employmentDetail.delete({ where: { userId: TRISHA_USER_ID } });
    console.log(`  ✅ Employment Detail: deleted`);
  } catch { console.log(`  ℹ️  Employment Detail: none found`); }

  // 10. Address Detail
  try {
    await prisma.addressDetail.delete({ where: { userId: TRISHA_USER_ID } });
    console.log(`  ✅ Address Detail: deleted`);
  } catch { console.log(`  ℹ️  Address Detail: none found`); }

  // 11. Document Status
  try {
    await prisma.userDocumentStatus.delete({ where: { userId: TRISHA_USER_ID } });
    console.log(`  ✅ Document Status: deleted`);
  } catch { console.log(`  ℹ️  Document Status: none found`); }

  // 12. Attribution Logs
  const attrLogs = await prisma.attributionLog.deleteMany({ where: { userId: TRISHA_USER_ID } });
  console.log(`  ✅ Attribution Logs: ${attrLogs.count} deleted`);

  // 13. Business Detail
  try {
    await prisma.businessDetail.delete({ where: { userId: TRISHA_USER_ID } });
    console.log(`  ✅ Business Detail: deleted`);
  } catch { console.log(`  ℹ️  Business Detail: none found`); }

  // 14. Partner Status
  try {
    await prisma.partnerStatus.delete({ where: { userId: TRISHA_USER_ID } });
    console.log(`  ✅ Partner Status: deleted`);
  } catch { console.log(`  ℹ️  Partner Status: none found`); }

  // 15. Finally delete the User record itself
  await prisma.user.delete({ where: { id: TRISHA_USER_ID } });
  console.log(`\n✅ User ID ${TRISHA_USER_ID} (TRISHA ROY CHOUDHURY) fully deleted from the database.`);
}

deleteTrisha()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
