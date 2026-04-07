const axios = require('axios');
const logger = require('../utils/logger');
const { getLosToken, invalidateToken } = require('./losAuthService');

// ─────────────────────────────────────────────────────────────────────────────
// LOS API Endpoint Configuration
// ─────────────────────────────────────────────────────────────────────────────
// Credentials confirmed by LOS team on 2026-04-07 (live public endpoints)
const LOS_SAVE_URL    = process.env.LOS_SAVE_URL    || 'http://59.95.101.93:7021/api/NewApplicationAPI/SaveNewApplication';
const LOS_KYC_DOC_URL = process.env.LOS_KYC_DOC_URL || 'http://59.95.101.93:7021/api/ChatBotKYCProof/SaveChatBotKYCProof';
const LOS_TIMEOUT_MS  = 30000; // 30-second timeout

// ─────────────────────────────────────────────────────────────────────────────
// Helper: build auth headers using a fresh (or cached) LOS Bearer token
// ─────────────────────────────────────────────────────────────────────────────
const getAuthHeaders = async () => {
    const token = await getLosToken();
    return {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`
    };
};

/**
 * Pushes a new loan application to the LOS system.
 *
 * Endpoint  : POST /api/NewApplicationAPI/SaveNewApplication
 * Auth      : Bearer <LOS token>
 * Payload   : Full LOS v1 payload (buildLosPayload from losMapping.js)
 *
 * @param   {object} payload  - Built by buildLosPayload()
 * @returns {object}          - { success, applicationId, caseNumber, rawData }
 */
const createLosApplication = async (payload) => {
    logger.info('[LOS API] Submitting application to LOS (SaveNewApplication)...', {
        applicationRef: payload.applicationId || payload.FirstName,
        amount: payload.LoanAmountRequired || payload.loanDetails?.amount
    });

    let headers;
    try {
        headers = await getAuthHeaders();
    } catch (authError) {
        logger.error(`[LOS API] ❌ Failed to get LOS auth token: ${authError.message}`);
        throw new Error(`LOS authentication failed: ${authError.message}`);
    }

    try {
        const response = await axios.post(LOS_SAVE_URL, payload, {
            headers,
            timeout: LOS_TIMEOUT_MS
        });

        const data = response.data;
        logger.info(`[LOS API] ✅ SaveNewApplication response received. Status: ${response.status}`, data);

        // LOS may return success under different structures — handle all observed variants
        // Note: LOS auth returns { isSuccess: true, Token: ... } so we also check isSuccess
        const isSuccess = data?.isSuccess === true
            || data?.IsSuccess === true
            || data?.StatusCode === 200
            || data?.status === 'SUCCESS'
            || data?.Status === 'Success'
            || data?.Result === 200
            || (response.status >= 200 && response.status < 300 && !data?.IsError && !data?.Message);

        if (isSuccess) {
            const appId   = data?.ApplicationId || data?.applicationId || data?.ApplicationID || null;
            const caseNum = data?.CaseNumber    || data?.caseNumber    || data?.CaseNo       || null;

            logger.info(`[LOS API] ✅ Application pushed to LOS. ApplicationId: ${appId}, CaseNumber: ${caseNum}`);
            return {
                success:       true,
                applicationId: appId,
                caseNumber:    caseNum,
                rawData:       data
            };
        }

        // LOS returned HTTP 200 but with a failure body
        logger.warn('[LOS API] ⚠️  LOS returned 200 but indicates failure in body:', data);
        throw new Error(`LOS SaveNewApplication failure: ${data?.Message || data?.message || JSON.stringify(data)}`);

    } catch (error) {
        if (error.response) {
            // 401 → token expired, invalidate cache so next call re-authenticates
            if (error.response.status === 401) {
                logger.warn('[LOS API] 401 Unauthorized — invalidating token cache.');
                invalidateToken();
            }
            const status = error.response.status;
            const body   = JSON.stringify(error.response.data);
            logger.error(`[LOS API] ❌ HTTP ${status} from LOS SaveNewApplication. Body: ${body}`);
            throw new Error(`LOS API returned HTTP ${status}: ${body}`);
        }
        if (error.code === 'ECONNABORTED') {
            logger.error('[LOS API] ❌ Request timed out after 30s.');
            throw new Error('LOS API request timed out. Check LOS server availability.');
        }
        logger.error(`[LOS API] ❌ Network error calling SaveNewApplication: ${error.message}`);
        throw error;
    }
};

/**
 * Pushes KYC document proof to the LOS system.
 *
 * Endpoint  : POST /api/ChatBotKYCProof/SaveChatBotKYCProof
 * Auth      : Bearer <LOS token>
 *
 * @param {object} docPayload - Document payload with ApplicationId and proof data
 * @returns {object}          - { success, rawData }
 */
const pushKycDocumentToLos = async (docPayload) => {
    logger.info('[LOS API] Pushing KYC document to LOS (SaveChatBotKYCProof)...', {
        applicationId: docPayload?.ApplicationId || docPayload?.applicationId
    });

    // Normalise KYC payload — LOS expects { ApplicationId, CreatedBy, Documents: [ { ProofType, ProofNumber, DocumentBase64 } ] }
    // If the caller passed a flat single-doc format, wrap it automatically
    let normalisedPayload = docPayload;
    if (!docPayload.Documents && (docPayload.ProofType || docPayload.ProofNumber)) {
        normalisedPayload = {
            ApplicationId: docPayload.ApplicationId || docPayload.applicationId || 0,
            CreatedBy:     docPayload.CreatedBy || 1,
            Documents: [
                {
                    ProofType:      docPayload.ProofType      || 'PAN',
                    ProofNumber:    docPayload.ProofNumber    || '',
                    DocumentBase64: docPayload.DocumentBase64 || '',
                    DocumentName:   docPayload.DocumentName   || ''
                }
            ]
        };
        logger.info('[LOS API] Auto-wrapped flat KYC payload into Documents array format.');
    }

    let headers;
    try {
        headers = await getAuthHeaders();
    } catch (authError) {
        logger.error(`[LOS API] ❌ Failed to get LOS auth token for KYC doc push: ${authError.message}`);
        throw new Error(`LOS authentication failed: ${authError.message}`);
    }

    try {
        const response = await axios.post(LOS_KYC_DOC_URL, normalisedPayload, {
            headers,
            timeout: LOS_TIMEOUT_MS
        });

        const data = response.data;
        logger.info(`[LOS API] ✅ SaveChatBotKYCProof response received. Status: ${response.status}`, data);

        const isSuccess = data?.isSuccess === true
            || data?.IsSuccess === true
            || data?.StatusCode === 200
            || data?.status === 'SUCCESS'
            || data?.Status === 'Success'
            || data?.Result === 200
            || (response.status >= 200 && response.status < 300 && !data?.IsError && !data?.Message);

        if (isSuccess) {
            logger.info('[LOS API] ✅ KYC document pushed to LOS successfully.');
            return { success: true, rawData: data };
        }

        logger.warn('[LOS API] ⚠️  LOS returned 200 but indicates failure in KYC doc push body:', data);
        throw new Error(`LOS SaveChatBotKYCProof failure: ${data?.Message || data?.message || JSON.stringify(data)}`);

    } catch (error) {
        if (error.response) {
            if (error.response.status === 401) {
                logger.warn('[LOS API] 401 Unauthorized — invalidating token cache (KYC push).');
                invalidateToken();
            }
            const status = error.response.status;
            const body   = JSON.stringify(error.response.data);
            logger.error(`[LOS API] ❌ HTTP ${status} from LOS SaveChatBotKYCProof. Body: ${body}`);
            throw new Error(`LOS KYC doc push returned HTTP ${status}: ${body}`);
        }
        if (error.code === 'ECONNABORTED') {
            logger.error('[LOS API] ❌ KYC doc push timed out after 30s.');
            throw new Error('LOS KYC document push timed out.');
        }
        logger.error(`[LOS API] ❌ Network error calling SaveChatBotKYCProof: ${error.message}`);
        throw error;
    }
};

/**
 * Pushes a status update for an existing loan application to LOS.
 * ⚠️  Endpoint not yet confirmed by LOS team — will skip until LOS_STATUS_URL is set.
 *
 * @param {string} losReferenceId  - The referenceId/caseNumber from LOS
 * @param {string} newStatus       - e.g. 'APPROVED', 'REJECTED'
 * @param {object} [meta]          - Optional additional fields
 */
const pushLoanStatusToLos = async (losReferenceId, newStatus, meta = {}) => {
    const LOS_STATUS_URL = process.env.LOS_STATUS_URL;

    if (!LOS_STATUS_URL) {
        logger.warn(
            `[LOS API] ⚠️  Status push skipped for referenceId "${losReferenceId}". ` +
            'LOS_STATUS_URL is not set in .env — awaiting endpoint from LOS team.'
        );
        return { success: false, skipped: true, reason: 'LOS_STATUS_URL not configured' };
    }

    let headers;
    try {
        headers = await getAuthHeaders();
    } catch (authError) {
        throw new Error(`LOS authentication failed: ${authError.message}`);
    }

    logger.info(`[LOS API] Pushing status "${newStatus}" for referenceId "${losReferenceId}" to LOS...`);

    try {
        const response = await axios.put(
            `${LOS_STATUS_URL}/${losReferenceId}/status`,
            { status: newStatus, ...meta, timestamp: new Date().toISOString() },
            { headers, timeout: LOS_TIMEOUT_MS }
        );

        logger.info(`[LOS API] ✅ Status push success. Response: ${JSON.stringify(response.data)}`);
        return { success: true, rawData: response.data };

    } catch (error) {
        const status = error.response ? error.response.status : 'NETWORK';
        const body   = error.response ? JSON.stringify(error.response.data) : error.message;
        logger.error(`[LOS API] ❌ Status push failed. HTTP ${status}: ${body}`);
        throw new Error(`LOS status push failed: HTTP ${status} - ${body}`);
    }
};

module.exports = {
    createLosApplication,
    pushKycDocumentToLos,
    pushLoanStatusToLos
};
