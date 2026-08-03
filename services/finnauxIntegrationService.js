const prisma = require('../utils/prismaClient');
const logger = require('../utils/logger');
const { buildFinnauxPayload } = require('../config/finnauxMapping');
const { sendApplicationToFinnaux } = require('./finnauxApiClient');

// Maximum times a job will be attempted before marking as permanently FAILED
const MAX_FAILURES = 7;

// Cap on concurrent payload builds so a large date-range export doesn't fire
// hundreds of simultaneous document downloads at DigitalOcean Spaces.
const PAYLOAD_BUILD_CONCURRENCY = 10;

/**
 * Runs `mapper` over `items` with at most `limit` in flight at once.
 */
const mapWithConcurrency = async (items, limit, mapper) => {
    const results = new Array(items.length);
    let nextIndex = 0;

    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (nextIndex < items.length) {
            const currentIndex = nextIndex++;
            results[currentIndex] = await mapper(items[currentIndex], currentIndex);
        }
    });

    await Promise.all(workers);
    return results;
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Core processor run by the cron worker (finnauxWorker.js)
 * Picks up PENDING jobs and FAILED jobs that are still under the retry limit.
 * Uses the same exponential backoff windows as the LOS integration.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const processPendingFinnauxIntegrations = async () => {
    logger.info('[FINNAUX WORKER] Checking for pending Finnaux integration jobs...');

    const now = new Date();
    const minus5m = new Date(now.getTime() - 5 * 60 * 1000);
    const minus30m = new Date(now.getTime() - 30 * 60 * 1000);
    const minus2h = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const minus12h = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    const minus24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const jobs = await prisma.finnauxIntegrationJob.findMany({
        where: {
            OR: [
                { status: 'PENDING' },
                { status: 'FAILED', retryCount: 1, updatedAt: { lte: minus5m } },
                { status: 'FAILED', retryCount: 2, updatedAt: { lte: minus30m } },
                { status: 'FAILED', retryCount: 3, updatedAt: { lte: minus2h } },
                { status: 'FAILED', retryCount: 4, updatedAt: { lte: minus12h } },
                { status: 'FAILED', retryCount: { gte: 5, lt: MAX_FAILURES }, updatedAt: { lte: minus24h } }
            ]
        },
        orderBy: { createdAt: 'asc' },
        take: 50
    });

    if (jobs.length === 0) {
        logger.info('[FINNAUX WORKER] No pending jobs found.');
        return;
    }

    logger.info(`[FINNAUX WORKER] Found ${jobs.length} job(s). Processing with 500ms pacing...`);

    for (const job of jobs) {
        try {
            await processSingleFinnauxJob(job);
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
            logger.error(`[FINNAUX WORKER] Uncaught error processing job ${job.id}: ${error.message}`, {
                jobId: job.id,
                userId: job.userId,
                applicationId: job.applicationId
            });
            await markJobFailed(job, error.message);
        }
    }
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Gathers every source record for a user/application and builds the current,
 * correct Finnaux payload. Shared by job processing (below) and by the job
 * creation sites (loanService.js, kycService.js) so a job's rawRequest is
 * always in the right shape — whether it's the initial snapshot at insert
 * time or the one written right before the actual send.
 *
 * Accepts an optional Prisma client so callers running inside a `$transaction`
 * (e.g. kycService.js's `tx`) can reuse this against the same transaction.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const buildFinnauxJobPayload = async (userId, applicationId, ipAddress, client = prisma) => {
    const user = await client.user.findUnique({
        where: { id: userId },
        select : {
            name: true,
            email: true,
            phone: true,
            dob: true,
            gender: true,
            verificationStatus: true,
            phoneVerified: true,
            phonePrefillDetail: {
                select: { response: true }
            },
        }
    });

    const employee = await client.employmentDetail.findUnique({
        where: { userId },
        select: { monthlyIncome: true ,
            employerName: true,
            employmentType: true,
            companyAddress: true,
        }
    }) || {};

    const business = await client.businessDetail.findUnique({
        where: { userId },
        select: { firmName: true,
            gstNumber: true,
            tradeLicense: true,
            companyPan: true,
            address: true,
            city: true,
            state: true,
            pincode: true,
        }
    }) || {};

    const application = await client.loanApplication.findUnique({
        where: { id: applicationId },
        select: {
            id: true,
            loanType: true,
            loanAmount: true,
            employeeName: true,
            loanAccountNumber: true,
            losApplicationNumber: true,
            reason: true,
            status:true
        }
    });

    const latestLocation = await client.userLocation.findFirst({
        where: { userId },
        orderBy: { capturedAt: 'desc' },
        select: {
            locality: true,
            city: true,
            state: true,
            postalCode: true,
            latitude: true,
            longitude: true,
        }
    });

    const userDocuments = await client.userDocument.findMany({
        where: { userId },
        select: {
            id: true,
            docType: true,
            fileName: true,
            filePath: true,
            fileUrl: true
        }
    });

    const address = await client.addressDetail.findUnique({
        where: { userId },
        select: {
            currentAddress: true,
            permanentAddress: true,
            city: true,
            state: true,
            postalCode: true,
            currentAddressType: true,
        }
    });

    const aadhaarVerification = await client.aadhaarVerification.findUnique({
        where: { userId },
        select: {
            aadhaarNumber: true,
            verified: true,
            verifiedAt: true,
            address: true,
            dob: true,
        }
    });

    const panVerification = await client.panVerification.findUnique({
        where: { userId },
        select: {
            panNumber: true,
            verified: true,
        }
    });

    if (!user) {
        throw new Error('User record not found in database.');
    }

    const phonePrefillData = user.phonePrefillDetail?.response || {};
    return buildFinnauxPayload(
        application,
        user,
        employee,
        business,
        address,
        aadhaarVerification,
        userDocuments,
        phonePrefillData,
        latestLocation,
        panVerification,
        ipAddress
    );
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Same as buildFinnauxJobPayload, but for many (userId, applicationId) pairs
 * at once. Fetches each related table exactly once with an `IN` clause, then
 * maps the results back to each job in-memory - avoiding the N+1 query blowup
 * of calling buildFinnauxJobPayload in a loop.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const buildFinnauxJobPayloadsBatch = async (jobs, client = prisma) => {
    const userIds = [...new Set(jobs.map(job => job.userId))];
    const applicationIds = [...new Set(jobs.map(job => job.applicationId))];

    const [
        users,
        employees,
        businesses,
        applications,
        locations,
        documents,
        addresses,
        aadhaarVerifications,
        panVerifications
    ] = await Promise.all([
        client.user.findMany({
            where: { id: { in: userIds } },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                dob: true,
                gender: true,
                verificationStatus: true,
                phoneVerified: true,
                phonePrefillDetail: { select: { response: true } },
            }
        }),
        client.employmentDetail.findMany({
            where: { userId: { in: userIds } },
            select: { userId: true, monthlyIncome: true, employerName: true, employmentType: true, companyAddress: true }
        }),
        client.businessDetail.findMany({
            where: { userId: { in: userIds } },
            select: { userId: true, firmName: true, gstNumber: true, tradeLicense: true, companyPan: true, address: true, city: true, state: true, pincode: true }
        }),
        client.loanApplication.findMany({
            where: { id: { in: applicationIds } },
            select: { id: true, loanType: true, loanAmount: true, employeeName: true, loanAccountNumber: true, losApplicationNumber: true, reason: true, status: true }
        }),
        client.userLocation.findMany({
            where: { userId: { in: userIds } },
            orderBy: { capturedAt: 'desc' },
            select: { userId: true, locality: true, city: true, state: true, postalCode: true, latitude: true, longitude: true }
        }),
        client.userDocument.findMany({
            where: { userId: { in: userIds } },
            select: { id: true, userId: true, docType: true, fileName: true, filePath: true, fileUrl: true }
        }),
        client.addressDetail.findMany({
            where: { userId: { in: userIds } },
            select: { userId: true, currentAddress: true, permanentAddress: true, city: true, state: true, postalCode: true, currentAddressType: true }
        }),
        client.aadhaarVerification.findMany({
            where: { userId: { in: userIds } },
            select: { userId: true, aadhaarNumber: true, verified: true, verifiedAt: true, address: true, dob: true }
        }),
        client.panVerification.findMany({
            where: { userId: { in: userIds } },
            select: { userId: true, panNumber: true, verified: true }
        })
    ]);

    const byId = (rows) => new Map(rows.map(row => [row.id, row]));
    const byUserId = (rows) => new Map(rows.map(row => [row.userId, row]));
    const documentsByUserId = documents.reduce((map, doc) => {
        if (!map.has(doc.userId)) map.set(doc.userId, []);
        map.get(doc.userId).push(doc);
        return map;
    }, new Map());

    const usersMap = byId(users);
    const employeesMap = byUserId(employees);
    const businessesMap = byUserId(businesses);
    const applicationsMap = byId(applications);
    // locations are ordered by capturedAt desc, so the first one seen per userId is the latest
    const latestLocationByUserId = new Map();
    for (const location of locations) {
        if (!latestLocationByUserId.has(location.userId)) {
            latestLocationByUserId.set(location.userId, location);
        }
    }
    const addressesMap = byUserId(addresses);
    const aadhaarVerificationsMap = byUserId(aadhaarVerifications);
    const panVerificationsMap = byUserId(panVerifications);

    const jobsWithUser = jobs.filter((job) => {
        if (usersMap.has(job.userId)) return true;
        logger.error(`[FINNAUX] Skipping payload build: User record not found for userId ${job.userId}.`);
        return false;
    });

    const payloads = await mapWithConcurrency(jobsWithUser, PAYLOAD_BUILD_CONCURRENCY, (job) => {
        const user = usersMap.get(job.userId);
        const phonePrefillData = user.phonePrefillDetail?.response || {};
        return buildFinnauxPayload(
            applicationsMap.get(job.applicationId),
            user,
            employeesMap.get(job.userId) || {},
            businessesMap.get(job.userId) || {},
            addressesMap.get(job.userId),
            aadhaarVerificationsMap.get(job.userId),
            documentsByUserId.get(job.userId) || [],
            phonePrefillData,
            latestLocationByUserId.get(job.userId),
            panVerificationsMap.get(job.userId),
            job.ipAddress
        );
    });

    return payloads;
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Processes a single Finnaux integration job:
 *   1. Fetch user + application data from LIN database
 *   2. Build the Finnaux payload
 *   3. Push to Finnaux via HTTP POST
 *   4. Store the Finnaux reference on success
 * ─────────────────────────────────────────────────────────────────────────────
 */
const processSingleFinnauxJob = async (job) => {
    const { id, userId, applicationId, ipAddress } = job;
    logger.info(`[FINNAUX WORKER] Processing Job ID: ${id} | User: ${userId} | App: ${applicationId}`);

    const application = await prisma.loanApplication.findUnique({
        where: { id: applicationId },
        select: { loanAmount: true }
    });
    if (!application || !application.loanAmount || application.loanAmount <= 0) {
        throw new Error('Valid loan amount is required for the Finnaux push.');
    }

    const payload = await buildFinnauxJobPayload(userId, applicationId, ipAddress);

    await prisma.finnauxIntegrationJob.update({
        where: { id },
        data: { rawRequest: JSON.parse(JSON.stringify(payload)) }
    });

    const finnauxResponse = await sendApplicationToFinnaux(payload);

    if (finnauxResponse.success) {
        logger.info(`[FINNAUX WORKER] ✅ Job ${id} pushed successfully. ReferenceId: ${finnauxResponse.referenceId || 'N/A'}`);

        await prisma.finnauxIntegrationJob.update({
            where: { id },
            data: {
                status: 'SUCCESS',
                finnauxReferenceId: finnauxResponse.referenceId ? String(finnauxResponse.referenceId) : null,
                rawResponse: finnauxResponse.rawData ? JSON.parse(JSON.stringify(finnauxResponse.rawData)) : null,
                lastError: null
            }
        });
    } else {
        throw new Error('Finnaux responded with success=false or an unexpected body.');
    }
};

/**
 * Marks a job as FAILED and increments the retry counter.
 * Once retryCount >= MAX_FAILURES, the cron worker will no longer pick it up.
 */
const markJobFailed = async (job, errorMessage) => {
    const newRetryCount = (job.retryCount || 0) + 1;

    await prisma.finnauxIntegrationJob.update({
        where: { id: job.id },
        data: {
            status: 'FAILED',
            retryCount: newRetryCount,
            lastError: errorMessage
        }
    });

    if (newRetryCount >= MAX_FAILURES) {
        logger.error(
            `[FINNAUX WORKER] 🚨 Job ${job.id} has EXHAUSTED all ${MAX_FAILURES} retries. ` +
            `Manual intervention required. Last error: ${errorMessage}`
        );
    } else {
        logger.warn(
            `[FINNAUX WORKER] Job ${job.id} failed (attempt ${newRetryCount}/${MAX_FAILURES}). ` +
            `Will retry on next cron cycle. Error: ${errorMessage}`
        );
    }
};

module.exports = {
    processPendingFinnauxIntegrations,
    processSingleFinnauxJob,
    buildFinnauxJobPayload,
    buildFinnauxJobPayloadsBatch
};
