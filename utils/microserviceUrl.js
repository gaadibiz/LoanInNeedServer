require('dotenv').config()
exports.SERVICE_URLS = {
    requestDigilocker: `/api/v3/digilocker/createUrl`,
    getEAadhaar: `/api/v3/digilocker/geteaadhaar`,
    phonePrefill: `/api/v3/phonekyc/phone-prefill-v2`,
}
