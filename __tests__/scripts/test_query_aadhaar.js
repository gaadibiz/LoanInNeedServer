const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
    const records = await prisma.aadhaarVerification.findMany();
    console.log(JSON.stringify(records, null, 2));
    await prisma.$disconnect();
})();
