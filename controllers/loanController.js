const asyncHandler = require('express-async-handler');
const prisma = require('../utils/prismaClient');
const logger = require('../utils/logger');
const { BadRequestError } = require('../GlobalExceptionHandler/exception');
const { generateApplicationPdf, formatApplicationNumber } = require('../services/pdfService');
const path = require('path');
const fs = require('fs');
const { encodeFileToBase64 } = require('../utils/base64Encoder');
const axios = require('axios');
const https = require('https');
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const s3Client = require('../utils/s3Client');

// Free in-memory Bounded Cache Hack for S3 Base64 Files
// Speeds up repeated exports instantly
const S3_BASE64_CACHE = new Map();
const MAX_CACHE_SIZE = 100; // Limits to ~100 documents to prevent OOM memory leaks

const s3AxiosInstance = axios.create({
    httpsAgent: new https.Agent({ keepAlive: true, maxSockets: 50 })
});

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
    const { from, to, filterIncomplete } = req.query;

    if (!from || !to) {
        throw new BadRequestError('Both "from" and "to" query parameters are required in ISO format.');
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
         throw new BadRequestError('Invalid date format for "from" or "to" parameters.');
    }

    // 1. Fetch only IDs to prevent Out Of Memory (OOM) crashes and DB strain
    const applicationIds = await prisma.loanApplication.findMany({
        where: {
            createdAt: {
                gte: fromDate,
                lte: toDate
            }
        },
        select: { id: true }
    });

    // Set streaming headers immediately to bypass DigitalOcean 60s timeout
    res.setHeader('Content-Type', 'application/json');
    res.status(200);
    res.write('{"data":[');

    let isFirstApp = true;
    let totalProcessed = 0;
    const CHUNK_SIZE = 10; // Reduced to 10 to prevent Out-Of-Memory (OOM) crashes on DO App Platform

    for (let i = 0; i < applicationIds.length; i += CHUNK_SIZE) {
        const chunkIds = applicationIds.slice(i, i + CHUNK_SIZE).map(a => a.id);
        
        // 2. Fetch full data ONLY for this chunk
        const chunkApps = await prisma.loanApplication.findMany({
            where: { id: { in: chunkIds } },
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

        // 3. Filter the chunk
        let validChunk = chunkApps;
        if (filterIncomplete !== 'false') {
            validChunk = chunkApps.filter(app => {
                const u = app.user;
                if (!u) return false;

                if (!u.name) return false;
                const nameParts = u.name.trim().split(/\s+/).filter(Boolean);
                if (nameParts.length < 2) return false;

                const panNumber = u.panVerification?.panNumber;
                const aadhaarNumber = u.aadhaarVerification?.aadhaarNumber;
                if (!panNumber || !aadhaarNumber) return false;

                const isComplete = u.panVerification?.verified === true && u.aadhaarVerification?.verified === true;
                if (!isComplete) return false;

                const docTypes = (u.documents || []).map(d => d.docType);
                return docTypes.includes('BANK_STATEMENT');
            });
        }

        if (validChunk.length === 0) continue;
        
        const chunkResults = await Promise.all(validChunk.map(async app => {
        try {
        const u = app.user;
        const emp = u?.employment || {};
        const addr = u?.address || {};
        const loc = u?.locations?.[0] || {};
        const aadh = u?.aadhaarVerification || {};
        const pan = u?.panVerification || {};

        // Read file from local disk or S3 and return [base64, filename] or null
        const getBase64Safe = async (doc) => {
            if (!doc) return null;
            const docName = doc.fileName || (doc.filePath ? path.basename(doc.filePath) : (doc.docType ? `${doc.docType}.jpg` : 'document.jpg'));
            const DUMMY_PDF_BASE64 = 'JVBERi0xLjQKJcOkw7zDtsOfCjIgMCBvYmoKPDwvTGVuZ3RoIDMgb3V0cHV0Pj4Kc3RyZWFtCgplbmRzdHJlYW0KZW5kb2JqCjQgMCBvYmoKPDwvVHlwZSAvUGFnZS9QYXJlbnQgMSAwIFIvTWVkaWFCb3hbMCAwIDU5NSA4NDJdL1Jlc291cmNlczw8Pj4vQ29udGVudHMgMiAwIFI+PgplbmRvYmoKMSAwIG9iago8PC9UeXBlIC9QYWdlcy9LaWRzWzQgMCBSXS9Db3VudCAxPj4KZW5kb2JqCjUgMCBvYmoKPDwvVHlwZSAvQ2F0YWxvZy9QYWdlcyAxIDAgUj4+CmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAxODcgMDAwMDAgbiAKMDAwMDAwMDAxOSAwMDAwMCBuIAowMDAwMDAwMDAwIGYgCjAwMDAwMDAwNzggMDAwMDAgbiAKMDAwMDAwMDAyNDAgMDAwMDAgbiAKdHJhaWxlcgo8PC9TaXplIDYvUm9vdCA1IDAgUj4+CnN0YXJ0eHJlZgoyODgKJSVFT0Y=';
            try {
                if (!doc.filePath && !doc.fileUrl) {
                    return [DUMMY_PDF_BASE64, docName];
                }
                
                // Fetch from S3 if configured
                if (process.env.STORAGE_PROVIDER === 's3') {
                    let s3Key = null;
                    
                    if (doc.fileUrl && doc.fileUrl.includes(process.env.DO_SPACES_BUCKET)) {
                        try {
                            const urlObj = new URL(doc.fileUrl);
                            s3Key = decodeURIComponent(urlObj.pathname.substring(1));
                        } catch (e) {
                            // ignore parse error
                        }
                    } else if (doc.filePath) {
                        s3Key = doc.filePath.replace(/\\/g, '/'); // Ensure forward slashes
                    }

                    // Check Cache FIRST
                    if (s3Key && S3_BASE64_CACHE.has(s3Key)) {
                        logger.info(`[LOAN EXPORT] Serving S3 Document from Memory Cache: ${s3Key}`);
                        return [S3_BASE64_CACHE.get(s3Key), docName];
                    }

                    if (s3Key) {
                        try {
                            const command = new GetObjectCommand({
                                Bucket: process.env.DO_SPACES_BUCKET,
                                Key: s3Key
                            });
                            
                            const s3Response = await s3Client.send(command);
                            
                            const buffer = await new Promise((resolve, reject) => {
                                const chunks = [];
                                s3Response.Body.on('data', (chunk) => chunks.push(chunk));
                                s3Response.Body.on('end', () => resolve(Buffer.concat(chunks)));
                                s3Response.Body.on('error', reject);
                            });
                            
                            const b64 = buffer.toString('base64');
                            
                            // Save to Bounded Cache
                            if (S3_BASE64_CACHE.size >= 100) {
                                // Delete the oldest item (Map preserves insertion order)
                                const oldestKey = S3_BASE64_CACHE.keys().next().value;
                                S3_BASE64_CACHE.delete(oldestKey);
                            }
                            S3_BASE64_CACHE.set(s3Key, b64);
                            
                            return [b64, docName];
                        } catch (err) {
                            logger.warn(`[LOAN EXPORT] Error fetching from S3 Key: ${s3Key} | AWS Error: ${err.name} - ${err.message}`);
                        }
                    }
                }

                // Clean fallback: If S3 fails or is not configured, silently return the Dummy PDF.
                // No local disk searching, no DB flagging. Pure and seamless.
                return [DUMMY_PDF_BASE64, docName];
            } catch (err) {
                logger.error(`[LOAN EXPORT] Critical error encoding doc: ${err.message}`);
                return [DUMMY_PDF_BASE64, docName];
            }
        };

        // Get documents by type
        const getDocsByType = async (type) => {
            if (!u?.documents) return null;
            const docs = u.documents.filter(d => d.docType === type);
            if (docs.length === 0) return null;
            if (['ADDRESS', 'PAY_SLIP', 'BANK_STATEMENT'].includes(type)) {
                const results = await Promise.all(docs.map(d => getBase64Safe(d)));
                const filtered = results.filter(Boolean);
                return filtered.length > 0 ? filtered : null;
            }
            return await getBase64Safe(docs[0]);
        };

        // Fetch all document types concurrently to drastically reduce waiting time
        const [
            aadhaarFront,
            addressDocument,
            profilePicture,
            panCard,
            salarySlips,
            bankStatements
        ] = await Promise.all([
            getDocsByType('AADHAAR'),
            getDocsByType('ADDRESS'),
            getDocsByType('PHOTO'),
            getDocsByType('PAN'),
            getDocsByType('PAY_SLIP'),
            getDocsByType('BANK_STATEMENT')
        ]);
        
        const aadhaarBack = null;
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
            address1: addr.currentAddress || null,
            address2: addr.permanentAddress || null,
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
        } catch (appFormatError) {
            logger.error(`[LOAN EXPORT] Fallback triggered. Failed to load Application ID ${app.id}: ${appFormatError.message}`);
            return {
                applicationNumber: app.id,
                status: 'DATA_ERROR',
                reason: 'System fallback: Corrupted record skipped due to missing or invalid data files.',
                error: true
            };
        }
        }));

        // Stream this chunk of applications instantly
        chunkResults.forEach(app => {
            if (!isFirstApp) {
                res.write(',');
            }
            res.write(JSON.stringify(app));
            isFirstApp = false;
        });
        totalProcessed += chunkResults.length;
    }

    // End JSON array and response
    res.write(']}');
    res.end();
    
    logger.info(`Export Stream Completed Successfully for ${totalProcessed} records.`);
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
