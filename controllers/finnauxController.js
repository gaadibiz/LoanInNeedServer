const asyncHandler = require('express-async-handler');
const prisma = require('../utils/prismaClient');
const logger = require('../utils/logger');
const { NotFoundError, BadRequestError } = require('../GlobalExceptionHandler/exception');
const { buildFinnauxJobPayload, getBase64Documents } = require('../services/finnauxIntegrationService');
const { default: axios } = require('axios');

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
        where: { applicationId: parseInt(applicationId) },
        select: {
            id: true,
            userId: true,
            applicationId: true,
            ipAddress: true,
            aadharDocumentId: true,
            panDocumentId: true,
            salarySlipDocumentId: true,
            bankStatementDocumentId: true,
        }
    });

    let app;
    if (!job) {
        app = await prisma.loanApplication.findUnique({ where: { id: parseInt(applicationId) } });
        if (!app) {
            throw new NotFoundError(`LoanApplication ID ${applicationId} not found`);
        }
    }

    const userId = job ? job.userId : app.userId;

    let updated_documents = {}

    if (!job || (!job.aadharDocumentId && !job.panDocumentId && !job.salarySlipDocumentId && !job.bankStatementDocumentId)) {
        const userDocuments = await prisma.userDocument.findMany({
            where: { userId },
            select: {
                id: true,
                docType: true,
            },
            orderBy: { uploadedAt: 'desc' }
        });

        userDocuments.forEach(doc => {
            if (doc.docType === 'AADHAAR' && !updated_documents.aadharDocumentId) {
                updated_documents.aadharDocumentId = doc.id
            }
            if (doc.docType === 'PAN' && !updated_documents.panDocumentId) {
                updated_documents.panDocumentId = doc.id
            }
            if (doc.docType === 'PAY_SLIP' && !updated_documents.salarySlipDocumentId) {
                updated_documents.salarySlipDocumentId = doc.id
            }
            if (doc.docType === 'BANK_STATEMENT' && !updated_documents.bankStatementDocumentId) {
                updated_documents.bankStatementDocumentId = doc.id
            }
        })
    }

    if (!job) {
        job = await prisma.finnauxIntegrationJob.create({
            data: {
                ...updated_documents,
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
        data: { ...updated_documents, rawRequest: JSON.parse(JSON.stringify(payload)) }
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

const getFinnauxRawPayloads = asyncHandler(async (req, res) => {
    const { id } = req.params

    const { from, to } = req.query;

    const hasId = !!id;
    const hasDateRange = !!from && !!to;

    if (!hasId && !hasDateRange) {
        throw new BadRequestError(
            'Either provide "id" or both "from" and "to" query parameters.'
        );
    }

    let fromDate, toDate;
    if (from || to) {
        if ((from && !to) || (!from && to)) {
            throw new BadRequestError(
                'Both "from" and "to" must be provided together.'
            );
        }
        fromDate = new Date(from);
        toDate = new Date(to);

        if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
            throw new BadRequestError('Invalid date format for "from" or "to" parameters.');
        }

        toDate.setHours(23, 59, 59, 999);
    }

    const where = {
        ...(!id && fromDate && toDate ? {
            createdAt: { gte: fromDate, lte: toDate },
        } : id ? { applicationId: parseInt(id) } : {}),
    };

    const [totalCount, jobs] = await Promise.all([
        prisma.finnauxIntegrationJob.count({ where }),
        prisma.finnauxIntegrationJob.findMany({
            where,
            orderBy: { createdAt: 'asc' },
            select: { userId: true, applicationId: true, ipAddress: true, rawRequest: true }
        })
    ]);

    let documents = id ? await getBase64Documents(id) : {};
    let data = jobs.map(job => ({ ...job.rawRequest, ...documents,phonePrefill:{} }));

    //  const data = await buildFinnauxJobPayloadsBatch(jobs);

    res.status(200).json({
        success: true,
        count: data.length,
        totalCount,
        data
    });
});

const getFinnauxUserDocuments = asyncHandler(async (req, res) => {
    const { id } = req.query;
    let documentsInfo = await prisma.finnauxIntegrationJob.findUnique({
        where: { applicationId: parseInt(id) }, select: {
            aadharDocumentId: true,
            panDocumentId: true,
            salarySlipDocumentId: true,
            bankStatementDocumentId: true,
        }
    });
    console.log(documentsInfo);

    if (!documentsInfo) {
        throw new NotFoundError(`Finnaux integration job not found for applicationId: ${id}`);
    }

    let userDocuments = await prisma.userDocument.findMany({
        where: {
            id: {
                in: [
                    documentsInfo.aadharDocumentId,
                    documentsInfo.panDocumentId,
                    documentsInfo.salarySlipDocumentId,
                    documentsInfo.bankStatementDocumentId
                ].filter(Boolean)
            }
        },
        select: {
            docType: true,
            fileName: true,
            fileUrl: true,
        },
        orderBy: { uploadedAt: 'desc' }
    });

    console.log(userDocuments);

    let documentBase64 = await Promise.all(userDocuments.map(async (doc) => {
        let base64Data = null;
        let doctype = doc.docType === 'AADHAAR' ? 'aadhaarFront' : doc.docType === 'PAN' ? 'panCard' : doc.docType === 'PAY_SLIP' ? 'salarySlips' : doc.docType === 'BANK_STATEMENT' ? 'bankStatements' : doc.docType;
        try {
            if (doc.fileUrl) {
                const response = await axios.get(doc.fileUrl, { responseType: 'arraybuffer' });
                base64Data = Buffer.from(response.data, 'binary').toString('base64');
                if (!base64Data) return null;
                if(doctype==='bankStatements')
                    return { bankStatement: [base64Data, doc.fileName || null] };
                return { [doctype]: [base64Data, doc.fileName || null] };
            }
            return null;
        } catch (err) {
            logger.error(`[FINNAUX] Failed to encode document ${doc.id} (${doc.docType}): ${err.message}`);
            return null;
        }
    }));

    res.status(200).json({
        success: true,
        count: userDocuments.length,
        data: documentBase64
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
    /**{
    "employeeName": "Test",
    "id": "24",
    "status": "PENDING",
    "employeeId": "",
    "applicationNumber": "ABC",
    "reason": "test",
    "loanNo": "LoanAcNo"
	
  } */
    let {
        employeeName,
        status,
        applicationNo,
        reason
    } = req.body
    req.body.id = id
    let finnauxApplicationNumber =  applicationNo
    req.body.finnauxApplicationNumber =  applicationNo

    if (!id || !status) {
        throw new BadRequestError('Both "id" and "status" are required in the request body.');
    }

    const validStatuses = ['REJECTED', 'REJECTED', 'PENDING', 'HOLD', 'IN_PROGRESS', 'COMPLETED'];
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
            finnauxApplicationNumber: finnauxApplicationNumber || loanApplication.finnauxApplicationNumber,
            updatedAt: new Date()
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
        data: [{
            id: updatedApplication.id,
            status: updatedApplication.status,
            applicationNumber:updatedApplication.finnauxApplicationNumber,
            applicationNo: updatedApplication.finnauxApplicationNumber,
            ...req.body
        }]
    });
});

module.exports = {
    triggerFinnauxIntegration,
    getFinnauxRawPayloads,
    updateLoanStatusFromFinnaux,
    getFinnauxUserDocuments
};
