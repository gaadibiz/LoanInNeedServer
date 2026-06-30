const prisma = require('../utils/prismaClient');
const logger = require('../utils/logger');
const { enqueueJob } = require('../utils/postgresMQ');

async function createLoanApplication(userId, loanAmount, loanType, reqAttribution, ipAddress = '') {
    let partnerId = null;
    let attributionSource = 'ORGANIC';

    // 1. Check Locked Attribution on User (First-touch wins)
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user.attributedPartnerId) {
        partnerId = user.attributedPartnerId;
        attributionSource = user.attributionType || 'EXISTING_LOCK';
        logger.info(`[LOAN] Using locked attribution for User ${userId}: Partner ${partnerId}`);
    }
    // 2. Check Session Attribution (if not locked)
    else if (reqAttribution?.partnerId) {
        partnerId = reqAttribution.partnerId;
        attributionSource = reqAttribution.source;
        logger.info(`[LOAN] Using session attribution for User ${userId}: Partner ${partnerId}`);

        if (!user.attributedPartnerId) {
            await prisma.user.update({
                where: { id: userId },
                data: {
                    attributedPartnerId: partnerId,
                    attributionType: 'ONLINE_LINK',
                    attributionDate: new Date()
                }
            });
        }
    }

    // 3. Create Application with Attribution
    const application = await prisma.loanApplication.create({
        data: {
            userId,
            loanAmount: parseFloat(loanAmount),
            loanType: loanType || 'OTHER',
            status: 'PENDING',
            attributedPartnerId: partnerId,
            attributionSource: attributionSource,
            ipAddress: ipAddress
        }
    });

    // --- LOS INTEGRATION (MQ) ---
    try {
        await prisma.losIntegrationJob.create({
            data: {
                userId,
                ipAddress: ipAddress,
                applicationId: application.id,
                status: 'PENDING'
            }
        });
        
        // Example MQ integration for PDF / Email generation offloading
        // enqueueJob('pdf-generation', { applicationId: application.id });
        
        logger.info(`[LOAN] Created LOS Integration Job for Application ${application.id}`);
    } catch (error) {
        logger.error(`[LOAN] Failed to queue LOS Integration Job for App ${application.id}: ${error.message}`);
    }

    // 4. Log Event
    if (partnerId) {
        await prisma.attributionLog.create({
            data: {
                partnerId: parseInt(partnerId),
                userId: userId,
                action: 'APPLICATION_CREATED',
                metadata: JSON.stringify({ applicationId: application.id, amount: loanAmount })
            }
        });
    }

    return {
        applicationId: application.id,
        partnerId
    };
}

module.exports = {
    createLoanApplication
};
