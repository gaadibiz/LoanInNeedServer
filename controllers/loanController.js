const asyncHandler = require('express-async-handler');
const prisma = require('../utils/prismaClient');
const logger = require('../utils/logger');
const { BadRequestError } = require('../GlobalExceptionHandler/exception');
const { generateApplicationPdf, formatApplicationNumber } = require('../services/pdfService');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { encodeFileToBase64 } = require('../utils/base64Encoder');
const { supabase } = require('../config/supabase');
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'Documents';

/**
 * Fetches a file from a URL and returns its base64 string.
 */
function fetchFileAsBase64(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        client.get(url, (res) => {
            if (res.statusCode !== 200) {
                return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
            }
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks).toString('base64')));
            res.on('error', reject);
        }).on('error', reject);
    });
}

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

    const data = await Promise.all(applications.map(async (app) => {
        const u = app.user;
        const emp = u?.employment || {};
        const addr = u?.address || {};
        const loc = u?.locations?.[0] || {};
        const aadh = u?.aadhaarVerification || {};
        const pan = u?.panVerification || {};
        
        const getBase64Safe = async (doc) => {
            if (!doc) return null;

            const docName = doc.fileName || (doc.filePath ? path.basename(doc.filePath) : (doc.docType ? `${doc.docType}.jpg` : 'document.jpg'));
            
            try {
                if (!doc.filePath && !doc.fileUrl) return null;

                // 1. Try local disk (works in local dev)
                if (doc.filePath) {
                    const absolutePath = path.join(__dirname, '..', doc.filePath);
                    if (fs.existsSync(absolutePath)) {
                        const b64 = encodeFileToBase64(absolutePath, false);
                        return `${docName},${b64}`;
                    }
                }

                // 2. Try Supabase Storage directly using stored filePath
                //    filePath format: uploads/Documents/AADHAAR/73/timestamp_file.jpg
                //    Supabase path is the part after uploads/Documents/
                if (doc.filePath) {
                    const supabasePath = doc.filePath.replace(/^uploads\/[^\/]+\//, '');
                    const { data, error } = await supabase.storage
                        .from(SUPABASE_BUCKET)
                        .download(supabasePath);
                    if (!error && data) {
                        const arrayBuffer = await data.arrayBuffer();
                        const b64 = Buffer.from(arrayBuffer).toString('base64');
                        return `${docName},${b64}`;
                    }
                    logger.warn(`[LOAN EXPORT] Supabase download failed for ${supabasePath}: ${error?.message}`);
                }

                // 3. Try fileUrl via HTTP (last resort)
                if (doc.fileUrl && !doc.fileUrl.startsWith('uploads/')) {
                    const b64 = await fetchFileAsBase64(doc.fileUrl);
                    return `${docName},${b64}`;
                }

                return null;
            } catch (err) {
                logger.error(`[LOAN EXPORT] Error encoding ${doc.filePath || doc.fileUrl}: ${err.message}`);
                return null;
            }
        };

        // Helper to extract documents by type (async — awaits base64 fetch)
        const getDocsByType = async (type) => {
            if (!u?.documents) {
                return (type === 'ADDRESS' || type === 'PAY_SLIP') ? [] : null;
            }
            const docs = u.documents.filter(d => d.docType === type);
            if (docs.length === 0) {
                return (type === 'ADDRESS' || type === 'PAY_SLIP') ? [] : null;
            }
            if (['AADHAAR', 'PHOTO', 'PAN'].includes(type) && docs.length === 1) {
                return await getBase64Safe(docs[0]);
            }
            if (type === 'ADDRESS' || type === 'PAY_SLIP') {
                const results = await Promise.all(docs.map(d => getBase64Safe(d)));
                return results.filter(Boolean);
            }
            return await getBase64Safe(docs[0]);
        };

        let aadhaarFront = null;
        let aadhaarBack = null;
        const aadhaarDocs = u?.documents?.filter(d => d.docType === 'AADHAAR') || [];
        if (aadhaarDocs.length > 0) aadhaarFront = await getBase64Safe(aadhaarDocs[0]);
        if (aadhaarDocs.length > 1) aadhaarBack = await getBase64Safe(aadhaarDocs[1]);

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
            address1: addr.currentAddress || null,
            address2: null,
            landmark: null,
            pinCode: addr.postalCode || null,
            area: addr.city || null,
            district: addr.city || null,
            state: addr.state || null,
            const [addressDocument, profilePicture, panCard, salarySlips, bankStatements] =
                await Promise.all([
                    getDocsByType('ADDRESS'),
                    getDocsByType('PHOTO'),
                    getDocsByType('PAN'),
                    getDocsByType('PAY_SLIP'),
                    getDocsByType('BANK_STATEMENT'),
                ]);

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
                address1: addr.currentAddress || null,
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
                addressDocument: addressDocument.map(docStr => ["Base64", docStr]),
                aadhaarNo: aadh.aadhaarNumber || null,
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
                employmentProofDocument: null,
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
    }));

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
            status: status.toUpperCase(), // Assuming LOS sends 'APPROVED'/'REJECTED' etc
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
