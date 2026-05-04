const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const phone = '+919875403824';
  const user = await prisma.user.findFirst({ where: { phone } });
  const partner = await prisma.partner.findFirst({ where: { phone } });
  
  console.log('--- USER ---');
  console.log(user);
  
  console.log('--- PARTNER ---');
  console.log(partner);
  
  const phone2 = '9875403824';
  const user2 = await prisma.user.findFirst({ where: { phone: phone2 } });
  if (user2) {
    console.log('Found user without +91:', user2);
  }
}

check()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
