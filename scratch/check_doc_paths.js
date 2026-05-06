// Check what document paths are in the DB for all users
require('dotenv').config();
const prisma = require('../utils/prismaClient');

async function main() {
  const docs = await prisma.userDocument.findMany({
    select: {
      id: true,
      userId: true,
      docType: true,
      fileName: true,
      filePath: true,
      fileUrl: true,
      status: true,
    },
    orderBy: { userId: 'asc' }
  });

  console.log(`\nTotal documents in DB: ${docs.length}\n`);
  docs.forEach(d => {
    console.log(`ID:${d.id} User:${d.userId} Type:${d.docType}`);
    console.log(`  filePath: ${d.filePath}`);
    console.log(`  fileUrl:  ${d.fileUrl}`);
    console.log('');
  });

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
