const asyncHandler = require('express-async-handler');
const prisma = require('../utils/prismaClient');
const logger = require('../utils/logger');
const { NotFoundError } = require('../GlobalExceptionHandler/exception');

/**
 * @desc    Get all Loan Applications for the LOS bridging process.
 * @route   GET /api/los/applications
 * @access  Private (LOS API/Admin)
 */
const getApplicationsForLos = asyncHandler(async (req, res) => {
    // You could filter by status = "PENDING", or specific job execution criteria.
    // Including LosIntegrationJob to fetch related queue/tracking identifiers.
    const { status } = req.query;

    let filter = {};
    if (status) {
        filter.status = status.toUpperCase(); // e.g. 'PENDING'
    }

    const applications = await prisma.loanApplication.findMany({
        where: filter,
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                    dob: true,
                    panVerification: true,
                    aadhaarVerification: true,
                    address: true,
                    business: true,
                    status: true,
                    documents: {
                        select: {
                            docType: true,
                            fileUrl: true,
                            status: true
                        }
                    }
                }
            },
            employmentDetail: true,
            losIntegrationJob: true // Critical for bridging updates back
        },
        orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({
        message: 'Successfully retrieved target applications for LOS integration.',
        count: applications.length,
        applications
    });
});

/**
 * @desc    Update LOS Integration Job status (Webhook/Callback for LOS).
 * @route   PUT /api/los/applications/:applicationId/status
 * @access  Private (LOS API/Admin)
 */
const updateJobStatus = asyncHandler(async (req, res) => {
    const { applicationId } = req.params;
    const { status, losApplicationId, losCaseNumber, losKycId, lastError } = req.body;

    const job = await prisma.losIntegrationJob.findUnique({
        where: { applicationId: parseInt(applicationId) }
    });

    if (!job) {
        throw new NotFoundError(`No LOS integration job tracked for LoanApplication ID ${applicationId}`);
    }

    const updatedJob = await prisma.losIntegrationJob.update({
        where: { id: job.id },
        data: {
            status: status || job.status,
            losApplicationId: losApplicationId || job.losApplicationId,
            losCaseNumber: losCaseNumber || job.losCaseNumber,
            losKycId: losKycId || job.losKycId,
            lastError: lastError || job.lastError
        }
    });

    logger.info(`[LOS] Updated Job ${job.id} for Application ${applicationId} to status ${updatedJob.status}`);

    res.status(200).json({
        message: 'LOS Job state updated.',
        job: updatedJob
    });
});

module.exports = {
    getApplicationsForLos,
    updateJobStatus
};
