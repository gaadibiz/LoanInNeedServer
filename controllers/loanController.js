const asyncHandler = require('express-async-handler');
const prisma = require('../utils/prismaClient');
const logger = require('../utils/logger');
const { BadRequestError } = require('../GlobalExceptionHandler/exception');
const { generateApplicationPdf, formatApplicationNumber } = require('../services/pdfService');
const path = require('path');
const fs = require('fs');
const { encodeFileToBase64 } = require('../utils/base64Encoder');

/**
 * @desc    Apply for a Loan
 * @route   POST /api/loans/apply
 * @access  Private
 */
const applyForLoan = asyncHandler(async (req, res) => {
    const { loanAmount, purposeOfLoan, loanType } = req.body;
    const userId = req.user.id;

    // --- ATTRIBUTION LOGIC ---
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
    else if (req.attribution?.partnerId) {
        partnerId = req.attribution.partnerId;
        attributionSource = req.attribution.source;
        logger.info(`[LOAN] Using session attribution for User ${userId}: Partner ${partnerId}`);

        // Lock it now if not already locked (redundant check but safe)
        if (!user.attributedPartnerId) {
            await prisma.user.update({
                where: { id: userId },
                data: {
                    attributedPartnerId: partnerId,
                    attributionType: 'ONLINE_LINK', // Assuming session comes from link
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
            attributionSource: attributionSource
        }
    });

    // --- LOS INTEGRATION QUEUE ---
    // Push a new pending job to completely decouple the external API from UI
    try {
        await prisma.losIntegrationJob.create({
            data: {
                userId,
                applicationId: application.id,
                status: 'PENDING'
            }
        });
        logger.info(`[LOAN] Created LOS Integration Job for Application ${application.id}`);
    } catch (error) {
        // We log but DO NOT fail the loan creation since it's just an integration failure
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

    res.status(201).json({
        message: 'Loan application submitted successfully.',
        applicationId: application.id,
        attribution: partnerId ? `Partner ${partnerId}` : 'Organic'
    });
});

/**
 * @desc    Get status of loan application for all and for specific LIN IDs
 * @route   GET /api/loans/status
 * @access  Private (API Key)
 */
const getLoanStatus = asyncHandler(async (req, res) => {
    const { linId } = req.query;

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
    const { from, to } = req.query;

    if (!from || !to) {
        throw new BadRequestError('Both "from" and "to" query parameters are required in ISO format.');
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
         throw new BadRequestError('Invalid date format for "from" or "to" parameters.');
    }

    const applications = await prisma.loanApplication.findMany({
        where: {
            createdAt: {
                gte: fromDate,
                lte: toDate
            }
        },
        include: {
            user: {
                include: {
                    address: true,
                    employment: true,
                    business: true,
                    locations: true,
                    documents: true,
                    aadhaarVerification: true,
                    panVerification: true
                }
            }
        }
    });

    // Filter out incomplete applications — only export fully complete submissions
    const REQUIRED_DOC_TYPES = ['AADHAAR', 'PAN', 'PHOTO'];

    const validApplications = applications.filter(app => {
        const u = app.user;
        if (!u) return false;

        // 1. Name must be present with at least 2 words (first + last name)
        if (!u.name || u.name.trim() === '') return false;
        if (u.name.trim().split(/\s+/).length < 2) return false;

        // 2. PAN must be present AND verified
        if (!u.panVerification) return false;
        if (!u.panVerification.panNumber || u.panVerification.panNumber.trim() === '') return false;
        if (!u.panVerification.verified) return false;

        // 3. Aadhaar verification record must be present and aadhaarNumber must be provided
        if (!u.aadhaarVerification) return false;
        if (!u.aadhaarVerification.aadhaarNumber || u.aadhaarVerification.aadhaarNumber.trim() === '') return false;

        // 4. All required document types must be submitted
        const submittedDocTypes = new Set((u.documents || []).map(d => d.docType));
        for (const reqType of REQUIRED_DOC_TYPES) {
            if (!submittedDocTypes.has(reqType)) return false;
        }

        // 4. At least one income document (PAY_SLIP or BANK_STATEMENT) must be submitted
        if (!submittedDocTypes.has('PAY_SLIP') && !submittedDocTypes.has('BANK_STATEMENT')) return false;

        return true;
    });

    const data = validApplications.map(app => {
        const u = app.user;
        const emp = u?.employment || {};
        const addr = u?.address || {};
        const loc = u?.locations?.[0] || {};
        const aadh = u?.aadhaarVerification || {};
        const pan = u?.panVerification || {};

        // Read file from local disk and return [base64, filename] or null
        const getBase64Safe = (doc) => {
            if (!doc) return null;
            const docName = doc.fileName || (doc.filePath ? path.basename(doc.filePath) : (doc.docType ? `${doc.docType}.jpg` : 'document.jpg'));
            try {
                if (!doc.filePath) return null;
                const absolutePath = path.join(__dirname, '..', doc.filePath);
                if (fs.existsSync(absolutePath)) {
                    const b64 = encodeFileToBase64(absolutePath, false);
                    return [b64, docName];
                }
                logger.warn(`[LOAN EXPORT] File not found on disk: ${absolutePath}`);
                return null;
            } catch (err) {
                logger.error(`[LOAN EXPORT] Error encoding ${doc.filePath}: ${err.message}`);
                return null;
            }
        };

        // Get documents by type
        const getDocsByType = (type) => {
            if (!u?.documents) return null;
            const docs = u.documents.filter(d => d.docType === type);
            if (docs.length === 0) return null;
            if (['ADDRESS', 'PAY_SLIP', 'BANK_STATEMENT'].includes(type)) {
                const results = docs.map(d => getBase64Safe(d)).filter(Boolean);
                return results.length > 0 ? results : null;
            }
            return getBase64Safe(docs[0]);
        };

        const aadhaarFront           = getDocsByType('AADHAAR');
        const aadhaarBack            = null;

        const addressDocument        = getDocsByType('ADDRESS');
        const profilePicture         = getDocsByType('PHOTO');
        const panCard                = getDocsByType('PAN');
        const salarySlips            = getDocsByType('PAY_SLIP');
        const bankStatements         = getDocsByType('BANK_STATEMENT');
        const employmentProofDocument = (bankStatements && bankStatements.length > 0) ? bankStatements[0] : null;

        return {
            id: u?.customUserId || app.id.toString(),
            name: u?.name || null,
            fatherName: null,
            dob: u?.dob || null,
            gender: u?.gender || null,
            mobileNo: u?.phone || null,
            isMobileOtpVerified: u?.phoneVerified || false,
            personalEmail: u?.email || null,
            isPersonalEmailOtpVerified: true,
            incomeType: emp.employmentType || null,
            designation: emp.employerName || null,
            monthlyIncome: emp.monthlyIncome || null,
            workingYears: null,
            loanAmount: app.loanAmount || null,
            loanPeriod: null,
            loanPurpose: app.loanType || null,
            preferredEmiDate: null,
            bankAccountNo: null,
            ifscCode: null,
            bankName: null,
            address1: addr.city || addr.currentAddress || null,
            address2: null,
            landmark: null,
            pinCode: addr.postalCode || null,
            area: addr.city || null,
            district: addr.city || null,
            state: addr.state || null,
            geolocation: {
                latitude: loc.latitude || null,
                longitude: loc.longitude || null
            },
            addressDocument,
            aadhaarNo: aadh.aadhaarNumber
                ? aadh.aadhaarNumber.replace(/_DUP_\d+$/, '').trim() || null
                : null,
            panNo: pan.panNumber || null,
            profilePicture,
            aadhaarFront,
            aadhaarBack,
            panCard,
            termsAccepted: true,
            organizationName: emp.employerName || null,
            officeEmail: null,
            isOfficeEmailVerified: false,
            salarySlips,
            bankStatements,
            employmentProofDocument,
            createdAt: app.createdAt,
            updatedAt: app.updatedAt,
            isFullyFilled: true,
            isContinueApplicationLinkSent: true,
            stepsCompleted: 7,
            status: app.status,
            applicationNumber: app.id,
            loanAccountNumber: null,
            reason: null,
            employeeName: null
        };
    });

    res.status(200).json({ data });
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
