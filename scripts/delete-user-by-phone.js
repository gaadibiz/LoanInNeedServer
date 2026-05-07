/**
 * delete-user-by-phone.js
 * Deletes ALL records for a specific phone number across all related tables.
 * Usage: node scripts/delete-user-by-phone.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TARGET_PHONE = '+919875403824';

async function deleteUserByPhone() {
  console.log(`\n🔍 Looking up user with phone: ${TARGET_PHONE}`);

  const user = await prisma.user.findUnique({
    where: { phone: TARGET_PHONE },
    select: { id: true, name: true, phone: true, role: true },
  });

  if (!user) {
    console.log(`❌ No user found with phone number: ${TARGET_PHONE}`);
    return;
  }

  console.log(`\n✅ Found user:`);
  console.log(`   ID    : ${user.id}`);
  console.log(`   Name  : ${user.name}`);
  console.log(`   Phone : ${user.phone}`);
  console.log(`   Role  : ${user.role}`);

  if (user.role === 'SUPER_ADMIN') {
    console.log(`\n🚫 ABORT: This user is a SUPER_ADMIN. Refusing to delete.`);
    return;
  }

  const userId = user.id;

  console.log(`\n🗑️  Starting deletion for userId = ${userId}...\n`);

  // 1. LosIntegrationJob (depends on LoanApplication)
  const losJobs = await prisma.losIntegrationJob.deleteMany({ where: { userId } });
  console.log(`   ✔ LosIntegrationJob      : ${losJobs.count} deleted`);

  // 2. LoanApplication
  const loanApps = await prisma.loanApplication.deleteMany({ where: { userId } });
  console.log(`   ✔ LoanApplication        : ${loanApps.count} deleted`);

  // 3. Loan
  const loans = await prisma.loan.deleteMany({ where: { userId } });
  console.log(`   ✔ Loan                   : ${loans.count} deleted`);

  // 4. UserDocument
  const userDocs = await prisma.userDocument.deleteMany({ where: { userId } });
  console.log(`   ✔ UserDocument           : ${userDocs.count} deleted`);

  // 5. UserDocumentStatus
  const docStatus = await prisma.userDocumentStatus.deleteMany({ where: { userId } });
  console.log(`   ✔ UserDocumentStatus     : ${docStatus.count} deleted`);

  // 6. UserLocation
  const locations = await prisma.userLocation.deleteMany({ where: { userId } });
  console.log(`   ✔ UserLocation           : ${locations.count} deleted`);

  // 7. AadhaarVerification
  const aadhaar = await prisma.aadhaarVerification.deleteMany({ where: { userId } });
  console.log(`   ✔ AadhaarVerification    : ${aadhaar.count} deleted`);

  // 8. PanVerification
  const pan = await prisma.panVerification.deleteMany({ where: { userId } });
  console.log(`   ✔ PanVerification        : ${pan.count} deleted`);

  // 9. AddressDetail
  const address = await prisma.addressDetail.deleteMany({ where: { userId } });
  console.log(`   ✔ AddressDetail          : ${address.count} deleted`);

  // 10. EmploymentDetail
  const employment = await prisma.employmentDetail.deleteMany({ where: { userId } });
  console.log(`   ✔ EmploymentDetail       : ${employment.count} deleted`);

  // 11. BusinessDetail
  const business = await prisma.businessDetail.deleteMany({ where: { userId } });
  console.log(`   ✔ BusinessDetail         : ${business.count} deleted`);

  // 12. PartnerStatus
  const partnerStatus = await prisma.partnerStatus.deleteMany({ where: { userId } });
  console.log(`   ✔ PartnerStatus          : ${partnerStatus.count} deleted`);

  // 13. OtpVerification
  const otps = await prisma.otpVerification.deleteMany({ where: { userId } });
  console.log(`   ✔ OtpVerification        : ${otps.count} deleted`);

  // 14. AttributionLog (userId is nullable FK)
  const attrLogs = await prisma.attributionLog.deleteMany({ where: { userId } });
  console.log(`   ✔ AttributionLog         : ${attrLogs.count} deleted`);

  // 15. Finally — delete the User itself
  const deletedUser = await prisma.user.delete({ where: { id: userId } });
  console.log(`\n✅ User "${deletedUser.name}" (phone: ${deletedUser.phone}) has been fully deleted.\n`);
}

deleteUserByPhone()
  .catch((err) => {
    console.error('\n❌ Error during deletion:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
