const asyncHandler = require('express-async-handler');
const prisma = require('../utils/prismaClient');
const logger = require('../utils/logger');
const { NotFoundError } = require('../GlobalExceptionHandler/exception');

/**
 * @desc    Manually trigger the Finnaux Integration for an application
 * @route   POST /api/finnaux/applications/:applicationId/trigger
 * @access  Private (API Key / Admin)
 */
const triggerFinnauxIntegration = asyncHandler(async (req, res) => {
    const { applicationId } = req.params;

    let job = await prisma.finnauxIntegrationJob.findUnique({
        where: { applicationId: parseInt(applicationId) }
    });

    if (!job) {
        const app = await prisma.loanApplication.findUnique({ where: { id: parseInt(applicationId) } });
        if (!app) {
            throw new NotFoundError(`LoanApplication ID ${applicationId} not found`);
        }
        job = await prisma.finnauxIntegrationJob.create({
            data: {
                userId: app.userId,
                applicationId: app.id,
                ipAddress: app.ipAddress,
                status: 'PENDING'
            }
        });
    }

    const { processSingleFinnauxJob } = require('../services/finnauxIntegrationService');

    try {
        await processSingleFinnauxJob(job);

        const updatedJob = await prisma.finnauxIntegrationJob.findUnique({
            where: { id: job.id }
        });

        res.status(200).json({
            success: true,
            message: 'Finnaux integration triggered successfully.',
            job: updatedJob
        });
    } catch (error) {
        logger.error(`[FINNAUX] Manual trigger failed for job ${job.id}: ${error.message}`);
        res.status(500).json({
            success: false,
            message: 'Finnaux integration encountered an error.',
            error: error.message
        });
    }
});

module.exports = {
    triggerFinnauxIntegration
};
