const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.findMany().then(u => {
    console.log(u.map(x => ({id: x.id, phone: x.phone, email: x.email})));
    p.$disconnect();
});
