require('dotenv').config()
const SIGNZY_BASE_URL = process.env.SIGNZY_BASE_URL || 'https://api.signzy.app';
exports.SERVICE_URLS = {
    requestDigilocker: SIGNZY_BASE_URL + `/api/v3/digilocker-v2/createUrl`,
    getEAadhaar: SIGNZY_BASE_URL + `/api/v3/digilocker-v2/geteAadhaar`,
    phonePrefill: SIGNZY_BASE_URL + `/api/v3/phonekyc/phone-prefill-v2`,
    ipQualityRiskScore: SIGNZY_BASE_URL + `/api/v3/ipQuality/riskScores`,
    panExtensive: SIGNZY_BASE_URL + `/api/v3/pan-extensive/premium`,
}
