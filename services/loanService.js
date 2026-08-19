const prisma = require('../utils/prismaClient');
const logger = require('../utils/logger');
const { enqueueJob } = require('../utils/postgresMQ');
const phonePrefillService = require('./phonePrefillService');
const { buildFinnauxJobPayload } = require('./finnauxIntegrationService');
const { default: axios } = require('axios');
require('dotenv').config();

function evaluateEligibility({
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
} = {}) {
    // Signup-style Eligibility Check
    // Uses the payload format coming from the frontend Step 2
    if (monthlySalaryRange || salaryReceivedIn || occupation) {
        logger.info(`[ELIGIBILITY] Checking for User - Amount: ${loanAmount}, Salary: ${monthlySalaryRange}, ReceivedIn: ${salaryReceivedIn}, Occ: ${occupation}, City: ${city}`);

        if (
            salaryReceivedIn !== "Bank Transfer" ||
            monthlySalaryRange === "Less than Rs.25,000/-"
        ) {
            return {
                statusCode: 200,
                eligible: false,
                reason: "Does not meet basic criteria."
            };
        }
        return {
            statusCode: 200,
            eligible: true,
            message: "Eligible for next steps."
        };
    }

    // Calculator-style Eligibility Check
    if (income !== undefined && expense !== undefined && tenure !== undefined) {
        const expenseAmount = (income * expense) / 100;
        const netIncome = income - expenseAmount;
        const maxEmi = netIncome * 0.4; // 40% EMI rule
        const totalMonths = tenure * 12;
        const eligibleLoanAmount = maxEmi * totalMonths;

        return {
            statusCode: 200,
            eligible: true,
            eligibleAmount: eligibleLoanAmount > 0 ? eligibleLoanAmount : 0,
            emi: maxEmi > 0 ? maxEmi : 0
        };
    }

    return { statusCode: 400, error: "Invalid eligibility parameters provided." };
}

// Builds the frontend /signup deep link, carrying forward the Step 2 payload
// so the user isn't asked to re-enter it after registering their phone.
function buildSignupRedirectUrl({ loanAmount, purposeOfLoan, occupation, monthlySalaryRange, salaryReceivedIn, city, phone } = {}) {
    const FRONTEND_URL = (process.env.FRONTEND_URL || "https://test.loaninneed.in") + '/login'

    const params = { loanAmount, purposeOfLoan, occupation, monthlySalaryRange, salaryReceivedIn, city, phone };
    const query = Object.entries(params)
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .map(([key, value]) => `${key}=${encodeURI(value)}`)
        .join('&');

    return `${FRONTEND_URL}/signup${query ? `?${query}` : ''}`;
}

async function sendLoanApplicationToBumchum(userId, applicationId = '',) {
    console.log(userId);
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            dob: true,
            gender: true,
            profileType: true,
            aadhaarVerification: true,
            panVerification: true
        }
    });
    let application = applicationId ? (await prisma.loanApplication.findUnique({
        where: { id: applicationId },
        select: {
            id: true,
            loanAmount: true,
            loanType: true,
            status: true,
            reason: true,
            employeeName: true,
            loanAccountNumber: true,
            reason: true,
            ipAddress: true,
            reason: true,
        }
    })) : {}

    let userDocuments = applicationId ? (await prisma.userDocument.findMany({
        where: { userId },
        select: {
            id: true,
            docType: true,
            fileName: true,
            fileUrl: true,
            mimeType: true
        },
        orderBy: { uploadedAt: 'desc' }
    })) : []

    let documents = {}
    userDocuments.forEach(doc => {
        if (doc.docType === 'AADHAAR' && !documents.aadhaar) {
            documents.aadhaar = {
                document_name: 'Aadhaar',
                link: doc.fileUrl,
                file_name: doc.fileName,
                mime_type: doc.mimeType
            }
        }
        if (doc.docType === 'PAN' && !documents.pan) {
            documents.pan = {
                document_name: 'PAN',
                link: doc.fileUrl,
                file_name: doc.fileName,
                mime_type: doc.mimeType
            }
        }
        if (doc.docType === 'PAY_SLIP' && !documents.salaryslip) {
            documents.salaryslip = {
                document_name: 'Salary Slip',
                link: doc.fileUrl,
                file_name: doc.fileName,
                mime_type: doc.mimeType
            }
        }
        if (doc.docType === 'BANK_STATEMENT' && !documents.bankstatement) {
            documents.bankstatement = {
                document_name: 'BANK_STATEMENT',
                link: doc.fileUrl,
                file_name: doc.fileName,
                mime_type: doc.mimeType
            }
        }
    })
    const aadhaarVerification = await prisma.aadhaarVerification.findUnique({
        where: { userId },
        select: {
            aadhaarNumber: true,
            name: true,
            dob: true,
            gender: true,
            address: true,
        }
    });
    const addressDetail = await prisma.addressDetail.findUnique({
        where: { userId },
        select: {
            city: true,
            state: true,
            postalCode: true,
        }
    });
    const businessDetail = await prisma.businessDetail.findUnique({
        where: { userId },
        select: {
            firmName: true,
            gstNumber: true,
            tradeLicense: true,
            companyPan: true,
            address: true,
            city: true,
            state: true,
            pincode: true
        }
    });

    const employeeDetail = await prisma.employmentDetail.findUnique({
        where: { userId },
        select: {
            companyAddress: true,
            monthlyIncome: true,
            employerName: true,
            employmentType: true,
        }
    });
    const userLocation = await prisma.userLocation.findFirst({
        where: { userId },
        select: {
            latitude: true,
            longitude: true,
            accuracy: true,
            locality: true,
            city: true,
            state: true,
            country: true,
            postalCode: true,
            placeName: true,
        },
        orderBy: { capturedAt: 'desc' },
        take: 1
    });

    const phonePreFillDetails = await prisma.phonePrefillDetail.findUnique({
        where: { userId },
        select: {
            response: true,
        }
    });

    let utm = await prisma.utm.findUnique({
        where: { userId },
        select: {
            utmSource: true,
            utmMedium: true,
            utmCampaign: true,
            utmId: true,
            utmTerm: true,
            utmContent: true,
        }
    });

    console.log(process.env.BUMCHUM_SAVE_LEAD_BASE_URL)
    try {
        await axios.post(process.env.BUMCHUM_SAVE_LEAD_BASE_URL, {
            user,
            application: application || {},
            aadhaarVerification: aadhaarVerification || {},
            addressDetail: addressDetail || {},
            businessDetail: businessDetail || {},
            employeeDetail: employeeDetail || {},
            userLocation: userLocation || {},
            documents: documents || {},
            phonePreFillDetails: phonePreFillDetails?.response || {},
            country_code: '+91',
            id: application.id || null,
            user_id: user.id || null,
            source: 'WEBSITE',
            priority: 'HIGH',
            form_name: 'LOAN_IN_NEED',
            incoming_request: 'LOAN_IN_NEED',
            category_name: 'Loan Application',
            date_of_visit: new Date().toISOString(),
            cancellation_dead_reason: application.reason || '',
            employment_type_uuid:employeeDetail?.employmentType === 'SALARIED' ? 'e54e543d-a20e-47b5-8bf1-a087e910d92b':'3d9d2e30-2754-49f8-be31-3a14c1d720b7',
            action_item_category_uuid:'f22bd31f-b9cb-4c8e-a07b-50f9b7083812',
            ...utm
        }, {
            headers: {
                'auth-Key': process.env.BUMCHUM_AUTH_KEY,
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('Error sending loan application to Bumchum:', error);
        throw error;
    }
}

// Documents required by sendLoanApplicationToBumchum's payload mapping.
const BUMCHUM_REQUIRED_DOC_TYPES = ['AADHAAR', 'PAN', 'PAY_SLIP', 'BANK_STATEMENT'];

// KYC form data (LoanApplication) and documents are submitted at different times,
// so the Bumchum lead can only be pushed once both are available. A user can have
// several applications (re-applications), each gets its own push exactly once,
// mirroring how LOS/Finnaux jobs are created per application rather than per user.
async function checkAndPushBumchumIfReady(userId) {
    try {
        const documents = await prisma.userDocument.findMany({
            where: { userId, docType: { in: BUMCHUM_REQUIRED_DOC_TYPES } },
            select: { docType: true }
        });
        const uploadedTypes = new Set(documents.map(doc => doc.docType));
        const allRequiredDocsReceived = BUMCHUM_REQUIRED_DOC_TYPES.every(type => uploadedTypes.has(type));
        if (!allRequiredDocsReceived) return;

        const applications = await prisma.loanApplication.findMany({
            where: { userId, bumchumSyncedAt: null },
            orderBy: { createdAt: 'asc' }
        });

        for (const application of applications) {
            try {
                await sendLoanApplicationToBumchum(userId, application.id);

                await prisma.loanApplication.update({
                    where: { id: application.id },
                    data: { bumchumSyncedAt: new Date() }
                });
                logger.info(`[BUMCHUM] Synced application for userId=${userId} appId=${application.id}`);
            } catch (error) {
                logger.error(`[BUMCHUM] Failed to push application appId=${application.id} for User ${userId}: ${error.message}`);
            }
        }
    } catch (error) {
        logger.error(`[BUMCHUM] Failed to check/push application(s) for User ${userId}: ${error.message}`);
    }
}

async function createLoanApplication(userId, loanAmount, loanType, reqAttribution, ipAddress = '') {
    let partnerId = null;
    let attributionSource = 'ORGANIC';
    let userDocuments = (await prisma.userDocument.findMany({
        where: { userId },
        select: {
            id: true,
            docType: true,
            fileName: true,
            fileUrl: true,
        }
    })) || [];

    let updated_documents = {}

    userDocuments.forEach(doc => {
        if (doc.docType === 'AADHAAR') {
            updated_documents.aadharDocumentId = doc.id
        }
        if (doc.docType === 'PAN') {
            updated_documents.panDocumentId = doc.id
        }
        if (doc.docType === 'PAY_SLIP') {
            updated_documents.salarySlipDocumentId = doc.id
        }
        if (doc.docType === 'BANK_STATEMENT') {
            updated_documents.bankStatementDocumentId = doc.id
        }
    })
    // 1. Check Locked Attribution on User (First-touch wins)
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user.attributedPartnerId) {
        partnerId = user.attributedPartnerId;
        attributionSource = user.attributionType || 'EXISTING_LOCK';
        logger.info(`[LOAN] Using locked attribution for User ${userId}: Partner ${partnerId}`);
    }
    // 2. Check Session Attribution (if not locked)
    else if (reqAttribution?.partnerId) {
        partnerId = reqAttribution.partnerId;
        attributionSource = reqAttribution.source;
        logger.info(`[LOAN] Using session attribution for User ${userId}: Partner ${partnerId}`);

        if (!user.attributedPartnerId) {
            await prisma.user.update({
                where: { id: userId },
                data: {
                    attributedPartnerId: partnerId,
                    attributionType: 'ONLINE_LINK',
                    attributionDate: new Date()
                }
            });
        }
    }

    // 3. Create Application with Attribution
    // If this user already has a prior application, flag this one as a re-apply
    // (reason: '1') so Finnaux can see it's not the user's first application.
    const priorApplication = await prisma.loanApplication.findFirst({ where: { userId } });

    const application = await prisma.loanApplication.create({
        data: {
            userId,
            loanAmount: parseFloat(loanAmount),
            loanType: loanType || 'OTHER',
            status: 'PENDING',
            attributedPartnerId: partnerId,
            attributionSource: attributionSource,
            ipAddress: ipAddress,
            //reloan: priorApplication ? true : false,
            //reason: priorApplication ? '1' : null
        }
    });

    // --- PHONE PREFILL (Signzy) ---
    // Best-effort: fetched details are saved to PhonePrefillDetail and later
    // forwarded to LOS as-is by the LOS worker. Must not block loan submission.
    try {
        await phonePrefillService.fetchAndSavePrefillDetails(userId);
        logger.info(`[LOAN] Phone prefill details fetched and saved for User ${userId}`);
    } catch (error) {
        logger.error(`[LOAN] Failed to fetch/save phone prefill details for User ${userId}: ${error.message}`);
    }

    // --- LOS INTEGRATION (MQ) ---
    try {
        await prisma.losIntegrationJob.create({
            data: {
                userId,
                ipAddress: ipAddress,
                applicationId: application.id,
                status: 'PENDING'
            }
        });

        // Example MQ integration for PDF / Email generation offloading
        // enqueueJob('pdf-generation', { applicationId: application.id });

        logger.info(`[LOAN] Created LOS Integration Job for Application ${application.id}`);
    } catch (error) {
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

    (async () => {
        try {
            await sendLoanApplicationToBumchum(userId, application.id)
            // Mark synced so the document-upload flow (checkAndPushBumchumIfReady) doesn't push this application again later.
            await prisma.loanApplication.update({ where: { id: application.id }, data: { bumchumSyncedAt: new Date() } });
        } catch (error) {
            console.error('Error sending loan application to Bumchum:', error);
        }
    })();

    return {
        applicationId: application.id,
        partnerId
    };
}

module.exports = {
    createLoanApplication,
    evaluateEligibility,
    buildSignupRedirectUrl,
    sendLoanApplicationToBumchum,
    checkAndPushBumchumIfReady
};
