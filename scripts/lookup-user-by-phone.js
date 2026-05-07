const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const SEARCH = '9875403824';

p.user.findMany({
  where: { phone: { contains: SEARCH } },
  select: { id: true, name: true, phone: true, role: true },
})
.then((users) => {
  console.log('=== Users ===');
  console.log(JSON.stringify(users, null, 2));
  return p.partner.findMany({
    where: { phone: { contains: SEARCH } },
    select: { id: true, name: true, phone: true },
  });
})
.then((partners) => {
  console.log('=== Partners ===');
  console.log(JSON.stringify(partners, null, 2));
})
.catch((err) => console.error(err))
.finally(() => p.$disconnect());
