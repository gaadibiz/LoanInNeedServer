const asyncHandler = require('express-async-handler');
const prisma = require('../utils/prismaClient');
const logger = require('../utils/logger');
const { NotFoundError, BadRequestError } = require('../GlobalExceptionHandler/exception');
const { buildFinnauxJobPayload, getBase64Documents } = require('../services/finnauxIntegrationService');
const { default: axios } = require('axios');
const { updateLoanApplicationToBumchum } = require('../services/loanService');
const moment = require("moment-timezone");

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
        app = await prisma.loanApplication.findFirst({ where: { id: parseInt(applicationId), blacklist: false } });
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


const formatToIST = (date) => {
    if (!date) return null;

    const d = moment(date);

    if (!d.isValid()) return null;

    return d.tz("Asia/Kolkata").format("YYYY-MM-DDTHH:mm:ss.SSSZ");
};

const toFinnauxColumnNames = (user) => {
    const application = user.loanApplications[0] || {};
    const location = user.locations?.[0] || {};
    const utm = user.utm || {};
    const aadhaarDocument = user.documents?.find((document) => document.docType === 'AADHAAR');
    const panDocument = user.documents?.find((document) => document.docType === 'PAN');
    const ipQualityDetail = user.ipQualityDetail || {}
    const bankStatement = user.documents?.find((document) => document.docType === 'BANK_STATEMENT');
    const salarySlipDocuments = (user.documents || [])
        .filter((document) => document.docType === 'PAY_SLIP')
        .map((document) => document.fileUrl)
        .filter(Boolean);

    return {
        id: application.id || null,
        dob: user.dob,
        area: user.address?.city || null,
        city: user.address?.city || null,
        name: user.name,
        panNo: user.panVerification?.panNumber || null,
        aadhaarNo: user.aadhaarVerification?.aadhaarNumber || null,
        state: user.address?.state || null,
        extras: {},
        gender: user.gender,
        loanId: application.id || null,
        loanNo: application.loanAccountNumber || null,
        reason: application.reason || null,
        reloan: application.reloan ?? null,
        status: application.status || null,
        panCard: panDocument?.fileUrl || null,
        pinCode: user.address?.postalCode || null,
        address1: user.address?.permanentAddress || null,
        address2: '',
        bankName: null,
        district: user.address?.district || null,
        ifscCode: null,
        landmark: user.address?.landmark || null,
        mobileNo: user.phone,
        utmTerms: utm.utmTerm || null,
        utmMedium: utm.utmMedium || null,
        utmSource: utm.utmSource || null,
        employeeId: application.employeeId || null,
        fatherName: null,
        incomeType: application.employmentDetail?.employmentType || user.employment?.employmentType || null,
        loanAmount: application.loanAmount || null,
        loanPeriod: null,
        riskFactor: null,
        createdAt: application.createdAt ? formatToIST(application.createdAt) : null,
        updatedAt: application.updatedAt ? formatToIST(application.updatedAt) : null,
        geolocation: {
            latitude: ipQualityDetail.latitude ?? null,
            longitude: ipQualityDetail.longitude ?? null,
        },
        countryCode: ipQualityDetail.countryCode ?? null,
        ipAddress: ipQualityDetail.ipAddress ?? null,
        IPAddress: ipQualityDetail.ipAddress ?? null,
        fraudScore: ipQualityDetail.fraudScore ?? null,
        vpn: ipQualityDetail.vpn ?? null,
        IPStatus: (String(ipQualityDetail.recentAbuse) === 'true' || Number(ipQualityDetail.fraudScore)) > 0 ? 'F' : 'P',
        loanPurpose: application.loanType || null,
        officeEmail: null,
        salarySlips: salarySlipDocuments.length ? salarySlipDocuments : null,
        utmCampaign: utm.utmCampaign || null,
        utmContent: utm.utmContent || null,
        aadhaarFront: aadhaarDocument?.fileUrl || null,
        aadhaarBack: null,
        employeeName: application.employeeName || null,
        workingYears: null,
        bankAccountNo: null,
        monthlyIncome: application.employmentDetail?.monthlyIncome || user.employment?.monthlyIncome || null,
        personalEmail: user.email,
        termsAccepted: true,
        profilePicture: null,
        addressDocument: null,
        organizationName: user.employment?.employerName || ipQualityDetail.organization || null,
        preferredEmiDate: null,
        applicationNumber: null,
        loanAccountNumber: application.loanAccountNumber || null,
        isMobileOtpVerified: user.phoneVerified,
        isOfficeEmailVerified: false,
        employmentProofDocument: null,
        isPersonalEmailOtpVerified: false,
        ...(user.finnauxIntegrationJobs?.[0]?.rawResponse || {})
    };
};

const toFinnauxDateRangePayload = (user) => {
    const application = user.loanApplications[0] || {};
    const location = user.locations?.[0] || {};
    const utm = user.utm || {};
    const ipQualityDetail = user.ipQualityDetail || {}

    return {
        name: user.name,
        id: application.id || null,
        mobileNo: user.phone,
        loanPurpose: application.loanType || null,
        loanId: application.id || null,
        loanNo: application.loanAccountNumber || null,
        reason: application.reason || null,
        reloan: application.reloan ?? null,
        loanAmount: application.loanAmount || null,
        createdAt: application.createdAt ? formatToIST(application.createdAt) : null,
        updatedAt: application.updatedAt ? formatToIST(application.updatedAt) : null,
        utmMedium: utm.utmMedium || null,
        gender: user.gender,
        status: application.status || null,
        bankName: null,
        ifscCode: null,
        geolocation: {
            latitude: ipQualityDetail.latitude || null,
            longitude: ipQualityDetail.longitude || null,
        },
        countryCode: ipQualityDetail.countryCode || null,
        ipAddress: ipQualityDetail.ipAddress || null,
        IPAddress: ipQualityDetail.ipAddress || null,
        fraudScore: ipQualityDetail.fraudScore || null,
        vpn: ipQualityDetail.vpn || null,
        IPStatus: (String(ipQualityDetail.recentAbuse) === 'true' || Number(ipQualityDetail.fraudScore)) > 0 ? 'F' : 'P',
        employeeName: application.employeeName || null,
        ...(user.finnauxIntegrationJobs?.[0]?.rawResponse || {})
    };
};

// const getFinnauxRawPayloads = asyncHandler(async (req, res) => {
//     const id = req.params.id;

//     const { from, to } = req.query;

//     const hasId = !!id;
//     const hasDateRange = !!from && !!to;

//     if (!hasId && !hasDateRange) {
//         throw new BadRequestError(
//             'Either provide "id" or both "from" and "to" query parameters.'
//         );
//     }

//     let fromDate, toDate;
//     if (from || to) {
//         if ((from && !to) || (!from && to)) {
//             throw new BadRequestError(
//                 'Both "from" and "to" must be provided together.'
//             );
//         }
//         fromDate = new Date(`${from}T00:00:00+05:30`);
//         toDate = new Date(`${to}T00:00:00+05:30`);
//         toDate.setTime(toDate.getTime() + 24 * 60 * 60 * 1000);

//         if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
//             throw new BadRequestError('Invalid date format for "from" or "to" parameters.');
//         }
//     }

//     const applicationFilter = id
//         ? { id: parseInt(id) }
//         : { createdAt: { gte: fromDate, lt: toDate } };
//     const finnauxJobFilter = id
//         ? { applicationId: parseInt(id) }
//         : { createdAt: { gte: fromDate, lt: toDate } };

//     const where = {
//         loanApplications: {
//             some: applicationFilter,
//         },
//     };

//     const userRelations = id
//         ? {
//             aadhaarVerification: true,
//             panVerification: true,
//             employment: true,
//             address: true,
//             documents: {
//                 orderBy: { uploadedAt: 'desc' },
//             },
//             loanApplications: {
//                 where: applicationFilter,
//                 orderBy: { createdAt: 'desc' },
//                 include: {
//                     employmentDetail: true,
//                 },
//             },
//             loans: {
//                 orderBy: { createdAt: 'desc' },
//             },
//             finnauxIntegrationJobs: {
//                 where: finnauxJobFilter,
//                 orderBy: { createdAt: 'desc' },
//                 select: { rawResponse: true, applicationId: true, userId: true },
//             },
//             ipQualityDetail: true,
//             utm: true,
//             status: true,
//         }
//         : {
//             // address: true,
//             loanApplications: {
//                 where: applicationFilter,
//                 orderBy: { createdAt: 'desc' },
//                 include: {
//                     employmentDetail: true,
//                 },
//             },
//             finnauxIntegrationJobs: {
//                 where: finnauxJobFilter,
//                 orderBy: { createdAt: 'desc' },
//                 select: { rawResponse: true },
//             },
//             ipQualityDetail: true,
//             utm: {
//                 select: {
//                     utmMedium: true,
//                 }
//             },
//         };

//     const users = await
//         prisma.user.findMany({
//             where,
//             include: userRelations,
//             orderBy: { updatedAt: 'desc' },
//         })

//     const documents = id ? await getBase64Documents(id) : {};
//     const data = id
//         ? users.map((user) => ({
//             ...toFinnauxColumnNames(user),
//             ...documents,
//         }))
//         : users.map(toFinnauxDateRangePayload);

//     res.status(200).json({
//         success: true,
//         count: data.length,
//         totalCount: users.length,
//         data,
//     });
// });

const getFinnauxRawPayloads = asyncHandler(async (req, res) => {
    const id = req.params.id;
    const { from, to } = req.query;

    const hasId = !!id;
    const hasDateRange = !!from && !!to;

    if (!hasId && !hasDateRange) {
        throw new BadRequestError(
            'Either provide "id" or both "from" and "to" query parameters.'
        );
    }

    if ((from && !to) || (!from && to)) {
        throw new BadRequestError(
            'Both "from" and "to" must be provided together.'
        );
    }

    let fromDate;
    let toDate;

    if (hasDateRange) {
        fromDate = new Date(`${from}T00:00:00+05:30`);
        toDate = new Date(`${to}T00:00:00+05:30`);

        if (
            Number.isNaN(fromDate.getTime()) ||
            Number.isNaN(toDate.getTime())
        ) {
            throw new BadRequestError(
                'Invalid date format for "from" or "to" parameters.'
            );
        }

        // Exclusive upper bound
        toDate.setDate(toDate.getDate() + 1);
    }

    const applicationFilter = hasId
        ? {
            id: Number(id),
            blacklist: false,
        }
        : {
            createdAt: {
                gte: fromDate,
                lt: toDate,
            },
            blacklist: false,
        };

    const finnauxJobFilter = hasId
        ? {
            applicationId: Number(id),
        }
        : {
            createdAt: {
                gte: fromDate,
                lt: toDate,
            },
        };

    /*
     * ---------------------------------------------------------
     * ID REQUEST
     * ---------------------------------------------------------
     */
    if (hasId) {
        const user = await prisma.user.findFirst({
            where: {
                loanApplications: {
                    some: applicationFilter,
                },
            },

            include: {
                aadhaarVerification: true,
                panVerification: true,
                employment: true,
                address: true,

                documents: {
                    orderBy: {
                        uploadedAt: 'desc',
                    },
                },

                loanApplications: {
                    where: applicationFilter,
                    orderBy: {
                        createdAt: 'desc',
                    },
                    include: {
                        employmentDetail: true,
                    },
                },
                finnauxIntegrationJobs: {
                    where: finnauxJobFilter,
                    select: {
                        rawResponse: true,
                        applicationId: true,
                        userId: true,
                    },
                },

                ipQualityDetail: true,
                utm: true,
                status: true,
            },
        });

        if (!user) {
            return res.status(200).json({
                success: true,
                count: 0,
                totalCount: 0,
                data: [],
            });
        }

        /*
         * KEEP DOCUMENT SECTION SAME
         */
        const documents = await getBase64Documents(id);

        const data = [
            {
                ...toFinnauxColumnNames(user),
                ...documents,
            },
        ];

        return res.status(200).json({
            success: true,
            count: data.length,
            totalCount: data.length,
            data,
        });
    }

    /*
     * ---------------------------------------------------------
     * DATE RANGE REQUEST
     * ---------------------------------------------------------
     */

    const users = await prisma.user.findMany({
        where: {
            loanApplications: {
                some: applicationFilter,
            },
        },

        select: {
            name: true,
            phone: true,
            gender: true,

            loanApplications: {
                where: applicationFilter,
                orderBy: {
                    createdAt: 'desc',
                },
                take: 1,
                select: {
                    id: true,
                    loanType: true,
                    loanAccountNumber: true,
                    reason: true,
                    reloan: true,
                    loanAmount: true,
                    createdAt: true,
                    updatedAt: true,
                    status: true,
                    employeeName: true,
                    employmentDetail: {
                        select: {
                            employmentType: true,
                            monthlyIncome: true,
                        },
                    },
                },
            },

            finnauxIntegrationJobs: {
                where: finnauxJobFilter,
                orderBy: {
                    createdAt: 'desc',
                },
                take: 1,
                select: {
                    rawResponse: true,
                },
            },

            ipQualityDetail: {
                select: {
                    latitude: true,
                    longitude: true,
                    countryCode: true,
                    ipAddress: true,
                    fraudScore: true,
                    vpn: true,
                    recentAbuse: true,
                },
            },

            utm: {
                select: {
                    utmMedium: true,
                },
            },
        },
    });

    users.sort((a, b) => {
        const timeA = a.loanApplications?.[0]?.createdAt ? new Date(a.loanApplications[0].createdAt).getTime() : 0;
        const timeB = b.loanApplications?.[0]?.createdAt ? new Date(b.loanApplications[0].createdAt).getTime() : 0;
        return timeB - timeA;
    });

    const data = users.map(toFinnauxDateRangePayload);

    return res.status(200).json({
        success: true,
        count: data.length,
        totalCount: users.length,
        data,
    });
});

const getFinnauxUserDocuments = asyncHandler(async (req, res) => {
    const { id } = req.query;
    if (!id) {
        throw new BadRequestError('Query param "id" is required.');
    }
    const app = await prisma.loanApplication.findFirst({
        where: { id: parseInt(id), blacklist: false },
        select: { id: true }
    });
    if (!app) {
        throw new NotFoundError(`LoanApplication ID ${id} not found`);
    }

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
                if (doctype === 'bankStatements')
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
        applicationNumber,
        reason
    } = req.body
    req.body.id = id
    let finnauxApplicationNumber = applicationNumber || applicationNo
    req.body.finnauxApplicationNumber = applicationNumber || applicationNo

    if (!id || !status) {
        throw new BadRequestError('Both "id" and "status" are required in the request body.');
    }

    const validStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'CLOSED', 'HOLD', 'IN_PROGRESS', 'COMPLETED', 'DISBUSTED'];
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
            finnauxApplicationNumber: req.body.applicationNumber,
            updatedAt: new Date()
        }
    });

    let finnauxLoanApplication = await prisma.finnauxIntegrationJob.findUnique({
        where: { applicationId: updatedApplication.id },
        select: { rawRequest: true, applicationId: true, userId: true }
    });

    if (finnauxLoanApplication) {
        const updatedRawResponse = await prisma.finnauxIntegrationJob.update({
            where: { applicationId: updatedApplication.id },
            data: {
                rawRequest: { ...finnauxLoanApplication.rawRequest, ...req.body },
                rawResponse: { ...req.body },
                finnauxApplicationId: req.body.applicationNumber
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
            applicationNumber: updatedApplication.finnauxApplicationNumber,
            applicationNo: updatedApplication.finnauxApplicationNumber,
            ...req.body
        }]
    });

    (async () => {
        try {
            await updateLoanApplicationToBumchum({
                user_id: finnauxLoanApplication.userId,
                updated_by_source: 'FINNAUX',
                id: finnauxLoanApplication.applicationId,
                actual_status: updatedApplication.status,
                reason: updatedApplication.reason,
            })
        } catch (e) {
            console.log("Error updating Loan Application to Bumchum", e)
        }
    })();
});

module.exports = {
    triggerFinnauxIntegration,
    getFinnauxRawPayloads,
    updateLoanStatusFromFinnaux,
    getFinnauxUserDocuments
};
