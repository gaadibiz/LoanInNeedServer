const { PrismaClient } = require('./Backend/node_modules/@prisma/client');
const prisma = new PrismaClient();

async function findDoc() {
    const docs = await prisma.userDocument.findMany({
        take: 10,
        orderBy: { uploadedAt: 'desc' },
        include: { user: true }
    });
    console.log(docs.map(d => d.filePath));
}
findDoc().catch(console.error).finally(() => prisma.$disconnect());
