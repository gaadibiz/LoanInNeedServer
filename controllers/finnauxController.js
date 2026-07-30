const asyncHandler = require('express-async-handler');
const prisma = require('../utils/prismaClient');
const logger = require('../utils/logger');
const { NotFoundError, BadRequestError } = require('../GlobalExceptionHandler/exception');

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

/**
 * @desc    Get Finnaux integration jobs with raw payload data, filtered by createdAt date range
 * @route   GET /api/finnaux/payloads?from=<ISO date>&to=<ISO date>
 * @access  Private (API Key)
 */
const getFinnauxRawPayloads = asyncHandler(async (req, res) => {
    const { from, to } = req.query;

    if (!from || !to) {
        throw new BadRequestError('Both "from" and "to" query parameters are required in ISO format.');
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
        throw new BadRequestError('Invalid date format for "from" or "to" parameters.');
    }

    const jobs = await prisma.finnauxIntegrationJob.findMany({
        where: { createdAt: { gte: fromDate, lte: toDate } },
        orderBy: { createdAt: 'asc' },
        select: { rawRequest: true }
    });

    const data = jobs.map(job => job.rawRequest);

    res.status(200).json({
        success: true,
        count: data.length,
        data
    });
});

/**
 * @desc    Update loan application status from Finnaux system.
 *          Finnaux is given `loanApplicationId` in the rawRequest payload
 *          (config/finnauxMapping.js) and calls back here with that same
 *          id to report the loan's decision status.
 * @route   POST /api/finnaux/applications/update-status
 * @access  Private (API Key)
 */
const updateLoanStatusFromFinnaux = asyncHandler(async (req, res) => {
    const { loanApplicationId, status, reason, finnauxApplicationNumber } = req.body;

    if (!loanApplicationId || !status) {
        throw new BadRequestError('Both "loanApplicationId" and "status" are required in the request body.');
    }

    const validStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'CLOSED', 'HOLD', 'IN_PROGRESS', 'COMPLETED'];
    const uppercaseStatus = status.toUpperCase();
    if (!validStatuses.includes(uppercaseStatus)) {
        throw new BadRequestError(`Invalid status value. Must be one of: ${validStatuses.join(', ')}`);
    }

    if (uppercaseStatus === 'REJECTED' && (!reason || reason.trim() === '')) {
        throw new BadRequestError('Reason is required when status is REJECTED.');
    }

    const applicationId = parseInt(loanApplicationId, 10);
    if (isNaN(applicationId)) {
        throw new BadRequestError(`Invalid "loanApplicationId": ${loanApplicationId}`);
    }

    const loanApplication = await prisma.loanApplication.findUnique({ where: { id: applicationId } });
    if (!loanApplication) {
        throw new NotFoundError(`Loan Application not found for loanApplicationId: ${loanApplicationId}`);
    }

    const updatedApplication = await prisma.loanApplication.update({
        where: { id: loanApplication.id },
        data: {
            status: uppercaseStatus,
            reason: reason || loanApplication.reason,
            finnauxApplicationNumber: finnauxApplicationNumber || loanApplication.finnauxApplicationNumber
        }
    });

    logger.info(`[FINNAUX] Updated LoanApplication ${updatedApplication.id} to status ${updatedApplication.status}`);

    res.status(200).json({
        success: true,
        message: 'Loan application updated successfully from Finnaux.',
        data: {
            applicationId: updatedApplication.id,
            status: updatedApplication.status,
            finnauxApplicationNumber: updatedApplication.finnauxApplicationNumber
        }
    });
});

module.exports = {
    triggerFinnauxIntegration,
    getFinnauxRawPayloads,
    updateLoanStatusFromFinnaux
};
