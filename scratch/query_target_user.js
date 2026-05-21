const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const phone = '8800222344';
  
  const user = await prisma.user.findFirst({
    where: {
      phone: {
        contains: phone
      }
    },
    include: {
      panVerification: true,
      aadhaarVerification: true,
      documents: true,
      loanApplications: true
    }
  });

  if (!user) {
    console.log("No user found with phone containing " + phone);
    return;
  }

  console.log("--- USER ---");
  console.log("ID:", user.id);
  console.log("Name:", user.name);
  console.log("Phone:", user.phone);
  console.log("verificationStatus:", user.verificationStatus);
  
  console.log("\n--- PAN VERIFICATION ---");
  console.log(user.panVerification);

  console.log("\n--- AADHAAR VERIFICATION ---");
  console.log(user.aadhaarVerification);

  console.log("\n--- DOCUMENTS ---");
  console.log(user.documents.map(d => ({ docType: d.docType, status: d.status, filePath: d.filePath })));

  console.log("\n--- LOAN APPLICATIONS ---");
  console.log(user.loanApplications.map(a => ({ id: a.id, status: a.status, createdAt: a.createdAt })));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
