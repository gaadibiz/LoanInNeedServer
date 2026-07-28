const axios = require('axios');
const logger = require('../utils/logger');
const { createCircuitBreaker } = require('../utils/circuitBreaker');

// ─────────────────────────────────────────────────────────────────────────────
// Finnaux API Endpoint Configuration
// ─────────────────────────────────────────────────────────────────────────────
const FINNAUX_API_URL = process.env.FINNAUX_API_URL || 'https://www.finnaux.com/api/v1/webhook/applyloan';
const FINNAUX_API_KEY_HEADER = process.env.FINNAUX_API_KEY_HEADER || 'x-api-key';
const FINNAUX_TIMEOUT_MS = parseInt(process.env.FINNAUX_API_TIMEOUT_MS) || 30000;

const finnauxSaveBreaker = createCircuitBreaker(
    (payload, config) => axios.post(FINNAUX_API_URL, payload, config),
    'Finnaux Apply Loan Webhook'
);

/**
 * Pushes a new loan application to the Finnaux webhook.
 *
 * Endpoint : POST /api/v1/webhook/applyloan
 * Auth     : static API key header (FINNAUX_API_KEY / FINNAUX_API_KEY_HEADER)
 *
 * @param   {object} payload - Built by buildFinnauxPayload()
 * @returns {object}         - { success, referenceId, rawData }
 */
const sendApplicationToFinnaux = async (payload) => {
    const apiKey = process.env.FINNAUX_API_KEY;
    if (!apiKey) {
        throw new Error('FINNAUX_API_KEY not configured — set it in .env before enabling the Finnaux integration.');
    }

    const headers = {
        'Content-Type': 'application/json',
        [FINNAUX_API_KEY_HEADER]: apiKey
    };

    logger.info('[FINNAUX API] Submitting application to Finnaux...', {
        name: payload.Name,
        loanAmount: payload.LoanAmount
    });

    try {
        const response = await finnauxSaveBreaker.fire(payload, {
            headers,
            timeout: FINNAUX_TIMEOUT_MS
        });

        const data = response.data;
        logger.info(`[FINNAUX API] ✅ Response received. Status: ${response.status}`, data);

        const isSuccess = (response.status >= 200 && response.status < 300)
            && data?.success !== false
            && data?.Success !== false
            && data?.status !== 'FAILED'
            && data?.Status !== 'FAILED';

        if (isSuccess) {
            const referenceId = data?.referenceId || data?.ReferenceId || data?.applicationId
                || data?.ApplicationId || data?.id || null;

            logger.info(`[FINNAUX API] ✅ Application pushed to Finnaux. ReferenceId: ${referenceId}`);
            return { success: true, referenceId, rawData: data };
        }

        logger.warn('[FINNAUX API] ⚠️  Finnaux returned 2xx but indicates failure in body:', data);
        throw new Error(`Finnaux webhook failure: ${data?.message || data?.Message || JSON.stringify(data)}`);

    } catch (error) {
        if (error.response) {
            const status = error.response.status;
            const body = JSON.stringify(error.response.data);
            logger.error(`[FINNAUX API] ❌ HTTP ${status} from Finnaux webhook. Body: ${body}`);
            throw new Error(`Finnaux API returned HTTP ${status}: ${body}`);
        }
        if (error.code === 'ECONNABORTED') {
            logger.error(`[FINNAUX API] ❌ Request timed out after ${FINNAUX_TIMEOUT_MS}ms.`);
            throw new Error('Finnaux API request timed out. Check Finnaux endpoint availability.');
        }
        logger.error(`[FINNAUX API] ❌ Error calling Finnaux webhook: ${error.message}`);
        throw error;
    }
};

module.exports = {
    sendApplicationToFinnaux
};
