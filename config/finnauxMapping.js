/**
 * Mapping for the Finnaux "Apply Loan" webhook payload.
 *
 * A number of fields Finnaux wants are not yet captured anywhere in our
 * schema (bank account/IFSC, father's name, designation, landmark, district,
 * UTM_* attribution, risk factor) — those are sent as null until we add
 * capture points for them. Enum values (Gender, LoanPurpose, Income-type) are
 * passed through as our own raw strings since Finnaux has not confirmed a
 * numeric/code mapping the way LOS did.
 */

const logger = require('../utils/logger');

/**
 * @param {object} application     - Prisma LoanApplication record
 * @param {object} user            - Prisma User record
 * @param {object} kycEmployment   - Prisma EmploymentDetail record (or null)
 * @param {object} kycAddress      - Prisma AddressDetail record (or null)
 * @param {object} panVerification - Prisma PanVerification record (or null)
 * @param {object} aadhaarVerification - Prisma AadhaarVerification record (or null)
 * @param {object} employee        - { monthlyIncome } (or null)
 * @param {object} phonePrefillData - Raw Signzy phone-prefill response (or null)
 * @param {object} latestLocation  - Prisma UserLocation record, most recent (or null)
 * @param {string} ipAddress       - IP captured at loan-apply time
 * @returns {object} Finnaux-ready payload
 */
const buildFinnauxPayload = (
    application,
    user,
    kycEmployment,
    kycAddress,
    panVerification,
    aadhaarVerification,
    employee,
    phonePrefillData,
    latestLocation,
    ipAddress
) => {
    const appId = application?.id || 'UNKNOWN';
    logger.info(`[FINNAUX MAPPING] Building payload for applicationId: ${appId}`);

    const payload = {
        Name: user.name || null,
        FName: null, // Father's name — not collected yet

        Gender: user.gender || null,
        DOB: user.dob ? new Date(user.dob).toISOString() : null,
        Mobile: user.phone || null,
        email: user.email || null,

        'Income-type': kycEmployment?.employmentType || null,
        Designation: null, // Not collected yet
        MonthlyIncome: employee?.monthlyIncome || null,

        LoanAmount: application?.loanAmount || null,
        LoanPurpose: application?.loanType || null,

        'Bank Account Number': null, // Not collected yet
        'Bank Name': null,           // Not collected yet
        'IFSC Code': null,           // Not collected yet

        Address1: kycAddress?.currentAddress || null,
        Address2: kycAddress?.permanentAddress || null,
        Landmark: null, // Not collected yet
        Area: latestLocation?.locality || null,
        District: null, // Not collected yet
        State: kycAddress?.state || null,
        Pincode: kycAddress?.postalCode || null,
        Geolocation: latestLocation
            ? { latitude: latestLocation.latitude, longitude: latestLocation.longitude }
            : null,

        'IP Address': ipAddress || null,
        PAN: panVerification?.panNumber || null,
        Aadhar: aadhaarVerification?.aadhaarNumber || null,

        UTM_Source: null,
        UTM_Medium: null,
        UTM_campaign: null,
        UTM_terms: null,
        UTM_content: null,

        RiskFactor: null, // Not collected yet

        'PhonePrefill': phonePrefillData || {},
        'Extras': {}
    };

    logger.info(`[FINNAUX MAPPING] ✅ Payload built for appId=${appId}`, {
        payload: {
            ...payload,
            PAN: payload.PAN ? `${payload.PAN.substring(0, 4)}****` : null,
            Aadhar: payload.Aadhar ? `****${payload.Aadhar.slice(-4)}` : null,
            Mobile: payload.Mobile ? `******${payload.Mobile.slice(-4)}` : null,
            'PhonePrefill': payload['PhonePrefill'] && Object.keys(payload['PhonePrefill']).length
                ? '[REDACTED]' : {}
        }
    });

    return payload;
};

module.exports = {
    buildFinnauxPayload
};
