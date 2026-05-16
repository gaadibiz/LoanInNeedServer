const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function main() {
  console.log('Seeding Super Admin account...');

  const hashedPassword = await bcrypt.hash('admin123', 10);

  const admin = await prisma.user.upsert({
    where: { phone: '+919999999999' },
    update: {},
    create: {
      customUserId: 'LIN000',
      name: 'Super Admin',
      phone: '+919999999999',
      phoneVerified: true,
      email: 'superadmin@test.com',
      password: hashedPassword,
      role: 'SUPER_ADMIN'
    }
  });

  console.log('✅ Super Admin account created!');
  console.log('ID:', admin.customUserId);
  console.log('Phone:', admin.phone);
}

main()
  .catch(e => {
    console.error('Error seeding admin:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
