const prisma = require('../utils/prismaClient');
const logger = require('../utils/logger');
const { enqueueJob } = require('../utils/postgresMQ');
const phonePrefillService = require('./phonePrefillService');
const { buildFinnauxJobPayload } = require('./finnauxIntegrationService');

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

async function createLoanApplication(userId, loanAmount, loanType, reqAttribution, ipAddress = '') {
    let partnerId = null;
    let attributionSource = 'ORGANIC';
    let userDocuments = (await prisma.userDocument.findMany({ where: { userId },select:{
        id: true,
        docType: true,
        fileName: true,
        fileUrl: true,
    } })) || [];

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
            reason: priorApplication ? '1' : null
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

    // --- FINNAUX INTEGRATION ---
    try {
        const rawRequest = await buildFinnauxJobPayload(userId, application.id, ipAddress);
        await prisma.finnauxIntegrationJob.create({
            data: {
                userId,
                ipAddress: ipAddress,
                applicationId: application.id,
                status: 'PENDING',
                ...updated_documents,
                rawRequest: JSON.parse(JSON.stringify(rawRequest))
            }
        });
        logger.info(`[LOAN] Created Finnaux Integration Job for Application ${application.id}`);
    } catch (error) {
        logger.error(`[LOAN] Failed to queue Finnaux Integration Job for App ${application.id}: ${error.message}`);
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

    return {
        applicationId: application.id,
        partnerId
    };
}

module.exports = {
    createLoanApplication,
    evaluateEligibility
};
