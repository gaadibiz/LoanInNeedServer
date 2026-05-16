const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Check ALL OTP records for 9875403824
  const otps = await prisma.otp.findMany({
    where: { phone: { contains: '9875403824' } },
    orderBy: { createdAt: 'desc' }
  });
  console.log('OTPs for 9875403824:');
  console.log(JSON.stringify(otps, null, 2));

  // Check what user record exists
  const user = await prisma.user.findFirst({
    where: { phone: { contains: '9875403824' } }
  });
  console.log('User record:');
  console.log(JSON.stringify(user, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => { await prisma.$disconnect(); });
