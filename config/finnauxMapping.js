/**
 * Mapping for the Finnaux "Apply Loan" webhook payload.
 *
 * A number of fields Finnaux wants are not yet captured anywhere in our
 * schema (bank account/IFSC, father's name, designation, working years, loan
 * period, preferred EMI date, landmark, district, UTM_* attribution, risk
 * factor) — those are sent as null until we add capture points for them.
 * Enum values (Gender, LoanPurpose, Income-type) are passed through as our
 * own raw strings since Finnaux has not confirmed a numeric/code mapping the
 * way LOS did.
 *
 * The DocumentType enum (UserDocument.docType) has no dedicated "address
 * proof" or "employment proof" type, so addressDocument/employmentProofDocument
 * stay null until those capture points exist. AADHAAR is stored as a single
 * scan, so aadhaarBack has no independent source and stays null.
 *
 * Document fields are sent as [base64Data, fileName] pairs (an array of such
 * pairs for salarySlips) rather than fileUrl links.
 */

const axios = require('axios');
const path = require('path');
const logger = require('../utils/logger');
const { encodeFileToBase64 } = require('../utils/base64Encoder');

/**
 * Finnaux wants documents inline as base64 rather than as a fileUrl link, so
 * each document is fetched (from DigitalOcean Spaces if fileUrl is set, else
 * from local disk) and encoded on the fly. Document fields are always
 * [base64Data, fileName], even when there's just one.
 */
const getDocumentBase64 = async (doc) => {
    if (doc.fileUrl) {
        const response = await axios.get(doc.fileUrl, { responseType: 'arraybuffer' });
        return Buffer.from(response.data, 'binary').toString('base64');
    }
    if (doc.filePath) {
        const absolutePath = path.join(__dirname, '..', doc.filePath);
        return encodeFileToBase64(absolutePath, false);
    }
    return null;
};

const buildDocumentEntry = async (doc) => {
    if (!doc) return null;

    let base64Data = null;
    try {
        if (doc.fileUrl) {
            const response = await axios.get(doc.fileUrl, { responseType: 'arraybuffer' });
            base64Data = Buffer.from(response.data, 'binary').toString('base64');
            if (!base64Data) return null;
            return [base64Data, doc.fileName || null];
        }
        return null;
    } catch (err) {
        logger.warn(`[FINNAUX MAPPING] Failed to encode document ${doc.id} (${doc.docType}): ${err.message}`);
        return null;
    }
};

/**
 * @param {object} application     - Prisma LoanApplication record
 * @param {object} user            - Prisma User record
 * @param {object} employee        - Prisma EmploymentDetail record (or null)
 * @param {object} business        - Prisma BusinessDetail record (or null)
 * @param {object} address         - Prisma AddressDetail record (or null)
 * @param {object} aadhaarVerification - Prisma AadhaarVerification record (or null)
 * @param {Array}  userDocuments   - Prisma UserDocument[] records
 * @param {object} phonePrefillData - Raw Signzy phone-prefill response (or null)
 * @param {object} latestLocation  - Prisma UserLocation record, most recent (or null)
 * @param {object} panVerification - Prisma PanVerification record (or null)
 * @param {string} ipAddress       - IP captured at loan-apply time
 * @returns {Promise<object>} Finnaux-ready payload
 */
const buildFinnauxPayload = async (
    application,
    user,
    employee,
    business,
    address,
    aadhaarVerification,
    phonePrefillData,
    latestLocation,
    panVerification,
    ipAddress,
) => {
    const appId = application?.id || 'UNKNOWN';
    logger.info(`[FINNAUX MAPPING] Building payload for applicationId: ${appId}`);

    const payload = {
        "loanId": application?.id || null,
        "id": application?.id || null, // Used by Finnaux to call back and update the loan application's status
        "name": user.name || null,
        "fatherName": null, // Not collected yet
        "dob": user.dob ? new Date(user.dob).toISOString() : null,
        "gender": user.gender || null,
        "mobileNo": user.phone || null,
        "isMobileOtpVerified": user.phoneVerified || false,
        "personalEmail": user.email || null,
        "isPersonalEmailOtpVerified": false,
        "incomeType": employee?.employmentType || null,
        "designation": null, // Not collected yet
        "monthlyIncome": employee?.monthlyIncome || null,
        "workingYears": null, // Not collected yet
        "loanAmount": application?.loanAmount || null,
        "loanPeriod": null, // Not collected yet
        "loanPurpose": application?.loanType || null,
        "preferredEmiDate": null, // Not collected yet
        "bankAccountNo": null, // Not collected yet
        "ifscCode": null, // Not collected yet
        "bankName": null, // Not collected yet
        "address1": address?.currentAddress || null,
        "address2": address?.permanentAddress || null,
        "landmark": null, // Not collected yet
        "pinCode": address?.postalCode || null,
        "area": address?.city || null,
        "district": null, // Not collected yet
        "state": address?.state || null,
        "geolocation": {
            "latitude": latestLocation?.latitude ?? null,
            "longitude": latestLocation?.longitude ?? null
        },
        "addressDocument": null, // No matching document type captured yet
        "aadhaarNo": aadhaarVerification?.aadhaarNumber || null,
        "panNo": panVerification?.panNumber || null,
        "profilePicture": null,
       "aadhaarFront": null,
        "aadhaarBack": null, // Aadhaar is captured as a single scan, no separate back side
       "panCard": null,
        "termsAccepted": true,
        "organizationName": business?.firmName || employee?.employerName || null,
        "officeEmail": null,
        "isOfficeEmailVerified": false,
        "salarySlips": null,
        "employmentProofDocument": null, // No matching document type captured yet
        "applicationNumber": null, // losApplicationNumber belongs to the LOS platform, not Finnaux
        "loanAccountNumber": application?.loanAccountNumber || null,
        "reason": application?.reason || null,
        "employeeName": application?.employeeName || null,
        "ipAddress": ipAddress || null,
        "utmSource": null,
        "utmMedium": null,
        "utmCampaign": null,
        "utmTerms": null,
        "utmContent": null,
        "riskFactor": null, // Not collected yet
        'phonePrefill': phonePrefillData || {},
        'extras': {},
        'status': application?.status,
        'createdAt': application?.createdAt,
        'updatedAt': application?.updatedAt

    };
    logger.info(`[FINNAUX MAPPING] ✅ Payload built for appId=${appId}`, {
        payload: {
            ...payload,
            panNo: payload.panNo ? `${payload.panNo.substring(0, 4)}****` : null,
            aadhaarNo: payload.aadhaarNo ? `****${payload.aadhaarNo.slice(-4)}` : null,
            mobileNo: payload.mobileNo ? `******${payload.mobileNo.slice(-4)}` : null,
            phonePrefill: payload.phonePrefill && Object.keys(payload.phonePrefill).length
                ? '[REDACTED]' : {},
        }
    });

    return payload;
};

module.exports = {
    buildFinnauxPayload
};
