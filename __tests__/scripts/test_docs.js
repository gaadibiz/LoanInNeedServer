const prisma = require('./utils/prismaClient');

async function test() {
    const docs = await prisma.userDocument.findMany({ take: 5 });
    console.log(docs);
    process.exit(0);
}

test().catch(console.error);
