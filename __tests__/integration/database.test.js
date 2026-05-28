const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

describe('Database Testing Suite (TC-DB)', () => {
    
    // TC-DB-001: ACID Properties Verification
    it('TC-DB-001: Should rollback transactions on failure', async () => {
        let errorCaught = false;
        try {
            await prisma.$transaction(async (tx) => {
                await tx.user.create({ data: { name: 'Tx Test', email: 'tx1@test.com', phone: '0000000000' } });
                throw new Error('Simulated Failure');
            });
        } catch (e) {
            errorCaught = true;
        }
        
        expect(errorCaught).toBe(true);
        const userExists = await prisma.user.findFirst({ where: { email: 'tx1@test.com' } });
        expect(userExists).toBeNull(); // Must have rolled back
    });

    // TC-DB-002: Index Performance
    it('TC-DB-002: Query by indexed field (email) should be fast', async () => {
        const start = Date.now();
        await prisma.user.findFirst({ where: { email: 'admin@loaninneed.in' } });
        const latency = Date.now() - start;
        
        expect(latency).toBeLessThan(100); // ms
    });
});
