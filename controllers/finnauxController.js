const asyncHandler = require('express-async-handler');
const prisma = require('../utils/prismaClient');
const logger = require('../utils/logger');
const { NotFoundError, BadRequestError } = require('../GlobalExceptionHandler/exception');
const { buildFinnauxJobPayloadsBatch, buildFinnauxJobPayload } = require('../services/finnauxIntegrationService');

/**
 * @desc    Rebuild and persist a job's rawRequest from current source data
 *          (documents as base64 + fileName). Does not send to Finnaux or
 *          touch job.status/retryCount — use the cron worker for that.
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

    const payload = await buildFinnauxJobPayload(job.userId, job.applicationId, job.ipAddress);

    const updatedJob = await prisma.finnauxIntegrationJob.update({
        where: { id: job.id },
        data: { rawRequest: JSON.parse(JSON.stringify(payload)) }
    });

    res.status(200).json({
        success: true,
        message: 'Finnaux rawRequest refreshed successfully (documents rebuilt as base64 + fileName).',
        job: updatedJob
    });
});

/**
 * @desc    Get Finnaux integration jobs with raw payload data, filtered by createdAt date range
 * @route   GET /api/finnaux/payloads?from=<ISO date>&to=<ISO date>&page=&pageLimit=
 * @access  Private (API Key)
 */
const MAX_FINNAUX_RANGE_DAYS = 31;
const DEFAULT_FINNAUX_PAGE_LIMIT = 10;
const MAX_FINNAUX_PAGE_LIMIT = 100;

const getFinnauxRawPayloads = asyncHandler(async (req, res) => {
    const { from, to, page, pageLimit } = req.query;

    if (!from || !to) {
        throw new BadRequestError('Both "from" and "to" query parameters are required in ISO format.');
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
        throw new BadRequestError('Invalid date format for "from" or "to" parameters.');
    }

    //const rangeDays = (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24);
    // if (rangeDays > MAX_FINNAUX_RANGE_DAYS) {
    //     throw new BadRequestError(`Date range too large. Maximum allowed range is ${MAX_FINNAUX_RANGE_DAYS} days — split the request into smaller windows.`);
    // }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limit = Math.min(MAX_FINNAUX_PAGE_LIMIT, Math.max(1, parseInt(pageLimit, 10) || DEFAULT_FINNAUX_PAGE_LIMIT));
    const offset = (pageNum - 1) * limit;

    const where = { createdAt: { gte: fromDate, lte: toDate } };

    const [totalCount, jobs] = await Promise.all([
        prisma.finnauxIntegrationJob.count({ where }),
        prisma.finnauxIntegrationJob.findMany({
            where,
            orderBy: { createdAt: 'asc' },
            skip: offset,
            take: limit,
            select: { userId: true, applicationId: true, ipAddress: true, rawRequest: true }
        })
    ]);

    let data = jobs.map(job => job.rawRequest);

    //  const data = await buildFinnauxJobPayloadsBatch(jobs);

    res.status(200).json({
        success: true,
        count: data.length,
        totalCount,
        page: pageNum,
        pageLimit: limit,
        hasMore: offset + data.length < totalCount,
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
    const { id } = req.params;
    const { ipAddress, status, reason, finnauxApplicationNumber } = req.body;

    if (!id || !status) {
        throw new BadRequestError('Both "id" and "status" are required in the request body.');
    }

    const validStatuses = ['REJECTED','REJECTED', 'PENDING', 'HOLD', 'IN_PROGRESS', 'COMPLETED'];
    const uppercaseStatus = status.toUpperCase();
    if (!validStatuses.includes(uppercaseStatus)) {
        throw new BadRequestError(`Invalid status value. Must be one of: ${validStatuses.join(', ')}`);
    }

    if (uppercaseStatus === 'REJECTED' && (!reason || reason.trim() === '')) {
        throw new BadRequestError('Reason is required when status is REJECTED.');
    }

    const applicationId = parseInt(id, 10);
    if (isNaN(applicationId)) {
        throw new BadRequestError(`Invalid "loanApplicationId": ${id}`);
    }

    const loanApplication = await prisma.loanApplication.findUnique({ where: { id: applicationId } });
    if (!loanApplication) {
        throw new NotFoundError(`Loan Application not found for loanApplicationId: ${id}`);
    }

    const updatedApplication = await prisma.loanApplication.update({
        where: { id: loanApplication.id },
        data: {
            status: uppercaseStatus,
            reason: reason || loanApplication.reason,
            finnauxApplicationNumber: finnauxApplicationNumber || loanApplication.finnauxApplicationNumber
        }
    });

    let finnauxLoanApplication = await prisma.finnauxIntegrationJob.findUnique({
        where: { applicationId: updatedApplication.id },
        select: { rawRequest: true }
    });

    if (finnauxLoanApplication) {
        const updatedRawResponse = await prisma.finnauxIntegrationJob.update({
            where: { applicationId: updatedApplication.id },
            data: {
                rawRequest: { ...finnauxLoanApplication.rawRequest, ...req.body },
                rawResponse: { ...req.body },
                finnauxApplicationId: req.body.applicationNo
            }
        });
    }

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
