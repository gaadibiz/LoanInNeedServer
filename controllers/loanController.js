const asyncHandler = require('express-async-handler');
const prisma = require('../utils/prismaClient');
const logger = require('../utils/logger');
const { BadRequestError } = require('../GlobalExceptionHandler/exception');
const { generateApplicationPdf, formatApplicationNumber } = require('../services/pdfService');
const path = require('path');
const { streamJsonArray } = require('../utils/streamExporter');
const { createLoanApplication, sendLoanApplicationToBumchum } = require('../services/loanService');
const { formatApplicationData } = require('../services/exportService');

let localActiveSubmissions = 0;
const MAX_CONCURRENT_SUBMISSIONS = process.env.MAX_CONCURRENT_SUBMISSIONS ? parseInt(process.env.MAX_CONCURRENT_SUBMISSIONS) : 10;
const ENABLE_SUBMISSION_LOAD_SHEDDING = process.env.ENABLE_SUBMISSION_LOAD_SHEDDING === 'true';

async function requestSubmissionSlot() {
    if (!process.send) {
        if (localActiveSubmissions >= MAX_CONCURRENT_SUBMISSIONS) return false;
        localActiveSubmissions++;
        return true;
    }
    return new Promise(resolve => {
        const reqId = crypto.randomUUID();
        const handler = (msg) => {
            if (msg.reqId === reqId) {
                process.removeListener('message', handler);
                resolve(msg.cmd === 'submissionSlotGranted');
            }
        };
        process.on('message', handler);
        process.send({ cmd: 'requestSubmissionSlot', reqId });
    });
}

function releaseSubmissionSlot() {
    if (!process.send) {
        localActiveSubmissions = Math.max(0, localActiveSubmissions - 1);
    } else {
        process.send({ cmd: 'releaseSubmissionSlot' });
    }
}


/**
 * @desc    Apply for a Loan
 * @route   POST /api/loans/apply
 * @access  Private
 */
const applyForLoan = asyncHandler(async (req, res) => {
    const { loanAmount, purposeOfLoan, loanType, monthlyIncome  } = req.body;
    const userId = req.user.id;
     let ip =  req.body.ipAddress || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    let ipAddress =  typeof ip === 'string' ? ip.split(',')[0].trim() : String(ip)

    const result = await createLoanApplication(userId, loanAmount, loanType, req.attribution, ipAddress);

    res.status(201).json({
        message: 'Loan application submitted successfully.',
        applicationId: result.applicationId,
        attribution: result.partnerId ? `Partner ${result.partnerId}` : 'Organic'
    });
});

/**
 * @desc    Get status of loan application for all and for specific LIN IDs
 * @route   GET /api/loans/status
 * @access  Private (API Key)
 */
const getLoanStatus = asyncHandler(async (req, res) => {
    const { linId } = req.query;

    if (linId) {
        // Strict input validation: Allow only alphanumeric, dash, and underscore
        // This explicitly rejects SQL injection payloads like "SELECT * FROM"
        const isValidFormat = /^[a-zA-Z0-9_-]+$/.test(linId);
        if (!isValidFormat) {
            return res.status(400).json({
                success: false,
                message: "Invalid linId format. SQL Injection payloads or special characters are not allowed."
            });
        }
    }

    let filter = {};
    if (linId) {
        filter = {
            user: { customUserId: linId }
        };
    }

    const applications = await prisma.loanApplication.findMany({
        where: filter,
        include: {
            user: true,
        }
    });

    const data = applications.map(app => ({
        linId: app.user?.customUserId || app.id.toString(),
        status: app.status,
        applicationNumber: app.id,
        createdAt: app.createdAt,
        updatedAt: app.updatedAt
    }));

    res.status(200).json({ data });
});

/**
 * @desc    Export detailed loan applications
 * @route   GET /api/loans/export
 * @access  Private (API Key)
 */
const exportLoanApplications = asyncHandler(async (req, res) => {
    const { from, to, filterIncomplete } = req.query;

    if (!from || !to) throw new BadRequestError('Both "from" and "to" query parameters are required in ISO format.');

    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
         throw new BadRequestError('Invalid date format for "from" or "to" parameters.');
    }

    const applicationIds = await prisma.loanApplication.findMany({
        where: { createdAt: { gte: fromDate, lte: toDate } },
        select: { id: true }
    });

    const CHUNK_SIZE = 1;
    const fetchChunkFn = async (chunkIds) => {
        const chunkApps = await prisma.loanApplication.findMany({
            where: { id: { in: chunkIds } },
            include: {
                user: {
                    include: { address: true, employment: true, business: true, locations: true, documents: true, aadhaarVerification: true, panVerification: true }
                }
            }
        });

        let validChunk = chunkApps;
        if (filterIncomplete !== 'false') {
            validChunk = chunkApps.filter(app => {
                const u = app.user;
                if (!u || !u.name || !u.panVerification?.panNumber || !u.aadhaarVerification?.aadhaarNumber) return false;
                const isComplete = u.panVerification.verified === true && u.aadhaarVerification.verified === true;
                if (!isComplete) return false;
                return (u.documents || []).some(d => d.docType === 'BANK_STATEMENT');
            });
        }
        
        return Promise.all(validChunk.map(formatApplicationData));
    };

    await streamJsonArray(res, applicationIds.map(a => a.id), CHUNK_SIZE, fetchChunkFn);
});

/**
 * @desc    Download loan application as PDF
 * @route   GET /api/loans/:applicationId/pdf
 * @access  Private (Auth Token)
 */
const downloadApplicationPdf = asyncHandler(async (req, res) => {
    const { applicationId } = req.params;
    const userId = req.user.id;

    const appId = parseInt(applicationId, 10);
    if (isNaN(appId)) {
        throw new BadRequestError('Invalid application ID.');
    }

    // Fetch the loan application with all related data
    const application = await prisma.loanApplication.findFirst({
        where: {
            id: appId,
            userId: userId  // Ensure user can only download their own
        },
        include: {
            user: {
                include: {
                    employment: true,
                    address: true,
                    panVerification: true,
                    aadhaarVerification: true,
                }
            }
        }
    });

    if (!application) {
        throw new BadRequestError('Loan application not found or access denied.');
    }

    logger.info('[PDF] Generating PDF for Application %s, User %s', appId, userId);

    const pdfBuffer = await generateApplicationPdf(application);
    const appNumber = formatApplicationNumber(application.id, application.createdAt);
    const fileName = `LoanApplication_${appNumber.replace(/\//g, '-')}.pdf`;

    res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': pdfBuffer.length,
    });

    res.send(pdfBuffer);
});

/**
 * @desc    Update loan application status from LOS system
 * @route   PUT /api/loans/update-status
 * @access  Private (API Key)
 */
const updateLoanStatusFromLos = asyncHandler(async (req, res) => {
    const { employeeId, employeeName, id, status, reason, loanNo, applicationNumber } = req.body;

    if (!id || !status) {
        throw new BadRequestError('Both "id" and "status" are required in the request body.');
    }

    const validStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'CLOSED', 'HOLD', 'IN_PROGRESS', 'COMPLETED'];
    const uppercaseStatus = status.toUpperCase();
    if (!validStatuses.includes(uppercaseStatus)) {
        throw new BadRequestError(`Invalid status value. Must be one of: ${validStatuses.join(', ')}`);
    }

    if (uppercaseStatus === 'REJECTED' && (!reason || reason.trim() === '')) {
        throw new BadRequestError('Reason is required when status is REJECTED.');
    }

    // Try finding the application either by its `id` (as integer) or `customUserId` of the User
    let loanApplication = null;
    const searchIdInt = parseInt(id, 10);

    // 1. Check if ID matches a LoanApplication.id directly
    if (!isNaN(searchIdInt)) {
        loanApplication = await prisma.loanApplication.findUnique({
            where: { id: searchIdInt }
        });
    }

    // 2. If not found, check if ID matches a User's customUserId (linId) and fetch their latest application
    if (!loanApplication) {
        const userWithApp = await prisma.user.findUnique({
            where: { customUserId: id.toString() },
            include: {
                loanApplications: {
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            }
        });
        
        if (userWithApp && userWithApp.loanApplications.length > 0) {
            loanApplication = userWithApp.loanApplications[0];
        }
    }

    if (!loanApplication) {
        throw new BadRequestError(`Loan Application not found for id: ${id}`);
    }

    // Map LOS payload to Prisma fields
    const updatedApplication = await prisma.loanApplication.update({
        where: { id: loanApplication.id },
        data: {
            // Prisma will enforce validation naturally if we feed it correct types
            status: uppercaseStatus,
            reason: reason || null,
            employeeId: employeeId ? employeeId.toString() : null,
            employeeName: employeeName || null,
            loanAccountNumber: loanNo ? loanNo.toString() : null,
            losApplicationNumber: applicationNumber ? applicationNumber.toString() : null
        },
        include: {
            user: {
                include: {
                    aadhaarVerification: true
                }
            }
        }
    });

    const returnedAadhaar = updatedApplication.user?.aadhaarVerification?.aadhaarNumber || null;

    res.status(200).json({
        success: true,
        message: 'Loan application updated successfully from LOS.',
        data: {
            applicationId: updatedApplication.id,
            status: updatedApplication.status,
            loanAccountNumber: updatedApplication.loanAccountNumber,
            aadhaarNo: returnedAadhaar
        }
    });
});

const checkEligibility = asyncHandler(async (req, res) => {
    const { 
        loanAmount, 
        monthlySalaryRange, 
        salaryReceivedIn, 
        cibilScore, 
        purposeOfLoan,
        occupation,
        city,
        income, 
        expense, 
        tenure 
    } = req.body;

    // Signup-style Eligibility Check
    // Now we use the new payload format coming from the frontend Step 2
    if (monthlySalaryRange || salaryReceivedIn || occupation) {
        // We log or process the new fields
        logger.info(`[ELIGIBILITY] Checking for User - Amount: ${loanAmount}, Salary: ${monthlySalaryRange}, ReceivedIn: ${salaryReceivedIn}, Occ: ${occupation}, City: ${city}`);
        
        if (
            salaryReceivedIn !== "Bank Transfer" || 
            monthlySalaryRange === "Less than Rs.25,000/-"
        ) {
            return res.status(200).json({
                eligible: false,
                reason: "Does not meet basic criteria."
            });
        }
        return res.status(200).json({
            eligible: true,
            message: "Eligible for next steps."
        });
    }

    // Calculator-style Eligibility Check
    if (income !== undefined && expense !== undefined && tenure !== undefined) {
        const expenseAmount = (income * expense) / 100;
        const netIncome = income - expenseAmount;
        const maxEmi = netIncome * 0.4; // 40% EMI rule
        const totalMonths = tenure * 12;
        const eligibleLoanAmount = maxEmi * totalMonths;

        return res.status(200).json({
            eligible: true,
            eligibleAmount: eligibleLoanAmount > 0 ? eligibleLoanAmount : 0,
            emi: maxEmi > 0 ? maxEmi : 0
        });
    }

    return res.status(400).json({ error: "Invalid eligibility parameters provided." });
});

module.exports = { 
    applyForLoan, 
    getLoanStatus, 
    exportLoanApplications, 
    downloadApplicationPdf, 
    updateLoanStatusFromLos,
    checkEligibility
};
