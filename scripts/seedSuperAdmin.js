const { PrismaClient } = require('@prisma/client');
const { hashPassword } = require('../utils/hash'); // Assuming this util exists/exports this
const prisma = new PrismaClient();

async function seed() {
    const phone = '+919999999999';
    const email = 'superadmin@test.com';
    const password = 'admin123';

    console.log('🌱 Seeding Super Admin...');

    try {
        // Check if exists
        let admin = await prisma.user.findFirst({
            where: {
                OR: [{ phone }, { email }]
            }
        });

        if (admin) {
            console.log('✅ Super Admin already exists:', admin.customUserId);
            // Force update role just in case
            await prisma.user.update({
                where: { id: admin.id },
                data: { role: 'SUPER_ADMIN', phone, email, phoneVerified: true }
            });
        } else {
            const hashedPassword = await hashPassword(password);
            admin = await prisma.user.create({
                data: {
                    name: 'Super Admin',
                    email,
                    phone,
                    password: hashedPassword,
                    role: 'SUPER_ADMIN',
                    phoneVerified: true,
                    phoneVerifiedAt: new Date(),
                    customUserId: 'ADMIN001'
                }
            });
            console.log('✅ Created Super Admin:', admin.customUserId);
        }
    } catch (e) {
        console.error('❌ Seeding failed:', e);
    } finally {
        await prisma.$disconnect();
    }
}

seed();
