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

    // Log the export API call
    try {
        const exportedApplicationIds = applications.map(app => app.id);
        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        const ua = req.headers['user-agent'] || 'UNKNOWN';

        await prisma.losExportLog.create({
            data: {
                ipAddress: typeof ip === 'string' ? ip.split(',')[0].trim() : String(ip),
                userAgent: ua.substring(0, 255), // avoid overflow if very long
                statusFilterRequested: status || null,
                exportedCount: applications.length,
                exportedApplicationIds: exportedApplicationIds
            }
        });
    } catch (err) {
        logger.error('[LOS] Failed to log export API call: ' + err.message);
    }

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

/**
 * @desc    Manually trigger the LOS Integration for an application
 * @route   POST /api/los/applications/:applicationId/trigger
 * @access  Private (API Key / Admin)
 */
const triggerLosIntegration = asyncHandler(async (req, res) => {
    const { applicationId } = req.params;
    
    // Find job
    let job = await prisma.losIntegrationJob.findUnique({
        where: { applicationId: parseInt(applicationId) }
    });
    
    if (!job) {
        // Find application to get userId
        const app = await prisma.loanApplication.findUnique({ where: { id: parseInt(applicationId) } });
        if (!app) {
            throw new NotFoundError(`LoanApplication ID ${applicationId} not found`);
        }
        // Create job if it doesn't exist
        job = await prisma.losIntegrationJob.create({
            data: {
                userId: app.userId,
                applicationId: app.id,
                status: 'PENDING'
            }
        });
    }
    
    // Import processSingleJob dynamically to avoid circular dependencies (if any) or just use it
    const { processSingleJob } = require('../services/losIntegrationService');
    
    try {
        await processSingleJob(job);
        
        // Fetch updated job
        const updatedJob = await prisma.losIntegrationJob.findUnique({
             where: { id: job.id }
        });
        
        res.status(200).json({
            success: true,
            message: 'LOS integration triggered successfully.',
            job: updatedJob
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'LOS integration encountered an error.',
            error: error.message
        });
    }
});

module.exports = {
    getApplicationsForLos,
    updateJobStatus,
    triggerLosIntegration
};
