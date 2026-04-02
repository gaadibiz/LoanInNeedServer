const asyncHandler = require('express-async-handler');
const prisma = require('../utils/prismaClient');
const logger = require('../utils/logger');
const { BadRequestError } = require('../GlobalExceptionHandler/exception');
const { generateApplicationPdf, formatApplicationNumber } = require('../services/pdfService');

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

    const data = applications.map(app => {
        const u = app.user;
        const emp = u?.employment || {};
        const addr = u?.address || {};
        const loc = u?.locations?.[0] || {};
        const aadh = u?.aadhaarVerification || {};
        const pan = u?.panVerification || {};
        
        // Helper to extract documents by type
        const getDocsByType = (type) => {
            if (!u?.documents) return null;
            const docs = u.documents.filter(d => d.docType === type);
            if (docs.length === 0) return null;
            if (['AADHAAR', 'PHOTO', 'PAN'].includes(type) && docs.length === 1) {
                return ["Base64", docs[0].fileName || docs[0].filePath];
            }
            if (type === 'ADDRESS' || type === 'PAY_SLIP') {
                return docs.map(d => ["Base64", d.fileName || d.filePath]);
            }
            return ["Base64", docs[0].fileName || docs[0].filePath];
        };

        let aadhaarFront = null;
        let aadhaarBack = null;
        const aadhaarDocs = u?.documents?.filter(d => d.docType === 'AADHAAR') || [];
        if (aadhaarDocs.length > 0) aadhaarFront = ["Base64", aadhaarDocs[0].fileName || aadhaarDocs[0].filePath];
        if (aadhaarDocs.length > 1) aadhaarBack = ["Base64", aadhaarDocs[1].fileName || aadhaarDocs[1].filePath];

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
            addressDocument: null, // Address not standard docType
            aadhaarNo: aadh.aadhaarNumber || null,
            panNo: pan.panNumber || null,
            profilePicture: getDocsByType('PHOTO'),
            aadhaarFront: aadhaarFront,
            aadhaarBack: aadhaarBack,
            panCard: getDocsByType('PAN'),
            termsAccepted: true,
            organizationName: emp.employerName || null,
            officeEmail: null,
            isOfficeEmailVerified: false,
            salarySlips: getDocsByType('PAY_SLIP'),
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

module.exports = { applyForLoan, getLoanStatus, exportLoanApplications, downloadApplicationPdf };
