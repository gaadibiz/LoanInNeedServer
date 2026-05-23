const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { name: { contains: 'Parimal', mode: 'insensitive' } },
        { name: { contains: 'Routh', mode: 'insensitive' } }
      ]
    }
  });

  if (users.length === 0) {
    console.log('No users found matching Parimal or Routh.');
    return;
  }

  console.log('Found users:');
  for (const user of users) {
    console.log(`- ${user.name} (ID: ${user.id}, Email: ${user.email}, Phone: ${user.phone})`);
  }
}

main()
  .catch(e => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
