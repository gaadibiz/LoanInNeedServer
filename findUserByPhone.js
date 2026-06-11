const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const phoneToSearch = '9111111114';
  
  console.log(`Searching for user with phone number containing: ${phoneToSearch}`);
  
  const users = await prisma.user.findMany({
    where: {
      phone: {
        contains: phoneToSearch
      }
    }
  });
  
  console.log("Users found:", JSON.stringify(users, null, 2));
}

main()
  .catch(e => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
