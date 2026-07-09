/**
 * Mappings for LOS Enums and Data Transformation
 *
 * Updated: June 2026 — Aligned with the new LOS SaveNewApplication contract.
 * See: LOS Integration Documentation § "New SaveNewApplication Payload"
 */

const logger = require('../utils/logger');

// ─────────────────────────────────────────────────────────────────────────────
// 1. Employment Type Mapping  (Confirmed by LOS team)
// ─────────────────────────────────────────────────────────────────────────────
const employmentMap = {
    SALARIED:      342,
    SELF_EMPLOYED: 343,
    STUDENT:       345,   // Fixed: was 344 (incorrect)
    UNEMPLOYED:    346,   // Fixed: was 345 (incorrect)
    OTHER:         342    // Defaulting to SALARIED — LOS did not provide an ID for OTHER
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. Salutation Mapping  (Confirmed by LOS team)
//    Derived from user's gender.
//    FEMALE has multiple options (274=Mrs., 275=Miss, 276=Ms.);
//    we default to 274 since we don't collect marital status.
// ─────────────────────────────────────────────────────────────────────────────
const salutationMap = {
    MALE:              273,   // Mr.
    FEMALE:            274,   // Mrs. (default for female; 275=Miss, 276=Ms. also valid)
    PREFER_NOT_TO_SAY: 273    // Defaulting to Mr.
};

// ─────────────────────────────────────────────────────────────────────────────
// 2b. Gender Mapping  (Confirmed by LOS team)
//     Separate from SalutationID — uses different IDs.
// ─────────────────────────────────────────────────────────────────────────────
const genderMap = {
    MALE:              45,
    FEMALE:            46,
    PREFER_NOT_TO_SAY: 45     // Defaulting to MALE
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. Purpose of Loan Mapping  (All 8 values confirmed by LOS team)
// ─────────────────────────────────────────────────────────────────────────────
const purposeOfLoanMap = {
    MEDICAL_EMERGENCY:  49,
    EDUCATION:          48,
    HOME_RENOVATION:    51,
    DEBT_CONSOLIDATION: 50,
    WEDDING:            101,
    BUSINESS:           102,
    TRAVEL:             52,
    OTHER:              53
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. Address Type Mapping  (Confirmed by LOS team)
// ─────────────────────────────────────────────────────────────────────────────
const addressTypeMap = {
    COMMUNICATION: 334,
    CURRENT:       335,
    PERMANENT:     336
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. Resident Type Mapping  (Confirmed by LOS team)
//    Maps our AddressType enum to LOS ResidentType IDs.
// ─────────────────────────────────────────────────────────────────────────────
const residentTypeMap = {
    OWNER_SELF_OR_FAMILY: 319,
    RENTED:               318
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. Qualification ID  (Static — we do not collect this data)
//    Hardcoded per client instruction. Update this value if LOS changes it.
// ─────────────────────────────────────────────────────────────────────────────
const QUALIFICATION_ID = 314;

// ─────────────────────────────────────────────────────────────────────────────
// 6. State Mapping (From table — unchanged)
// ─────────────────────────────────────────────────────────────────────────────
const stateMap = {
    "Maharashtra": 1109,
    "West Bengal": 1110,
    "Karnataka": 1111,
    "Gujarat": 1112,
    "Rajasthan": 1113,
    "Uttar Pradesh": 1114,
    "Bihar": 1115,
    "Telangana": 1116,
    "Andhra Pradesh": 1117,
    "Tamil Nadu": 1118,
    "Kerala": 1119,
    "Chhattisgarh": 1120,
    "Delhi": 1121,
    "Odisha": 1122,
    "Punjab": 1123,
    "Madhya Pradesh": 1124,
    "Jharkhand": 1125,
    "Assam": 1126,
    "Uttarakhand": 1127,
    "Haryana": 1128,
    "Jammu and Kashmir": 1129,
    "Himachal Pradesh": 1130
};

// Helper to calculate age from DOB
const calculateAge = (dobString) => {
    if (!dobString) return 25; // Default age if missing
    const dob = new Date(dobString);
    const diffMs = Date.now() - dob.getTime();
    const ageDt = new Date(diffMs);
    return Math.abs(ageDt.getUTCFullYear() - 1970);
};

// Helper: strip commas and SQL-dangerous chars — LOS SQL parser chokes on them
const losClean = (str) => {
    if (!str) return str;
    return String(str)
        .replace(/,/g, ' ')       // Commas → spaces (LOS SQL injection)
        .replace(/'/g, '')        // Single quotes (SQL string delimiter)
        .replace(/\s+/g, ' ')     // Collapse whitespace
        .trim();
};

// Helper: normalize phone for LOS — strip country code prefix, keep only digits
const losPhone = (phone) => {
    if (!phone) return '0000000000';
    return phone.replace(/^\+91/, '').replace(/[^0-9]/g, '') || '0000000000';
};

// Helper: validate final payload has no SQL-dangerous characters in any string field
const validatePayload = (payload, appId) => {
    const issues = [];
    const check = (obj, path = '') => {
        for (const [key, val] of Object.entries(obj)) {
            const fp = path ? `${path}.${key}` : key;
            if (typeof val === 'string' && /[,';]/.test(val)) {
                issues.push(`${fp}="${val}"`);
            } else if (val && typeof val === 'object' && !Array.isArray(val)) {
                check(val, fp);
            }
        }
    };
    check(payload);
    if (issues.length > 0) {
        logger.error(`[LOS MAPPING] ⚠️ DANGEROUS CHARS detected in payload for appId=${appId}: ${issues.join(', ')}`);
    }
    return issues;
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * NEW LOS PAYLOAD BUILDER — Confirmed LOS Contract (June 2026)
 * ─────────────────────────────────────────────────────────────────────────────
 * Builds the payload for POST /api/NewApplicationAPI/SaveNewApplication
 * matching the new streamlined contract confirmed by the LOS team.
 *
 * Changes from legacy (v1):
 *   - Removed: OrganizationID, LoanTypeID, ProductSchemeName, LoanCategoryCode,
 *              ProductCategoryCode, ProductName, Tenure, InterestRate, PayCheckAmt,
 *              Address.CityName, KYC_Individual, IsJointApplication, IsCoBorrower
 *   - Added:   PurposeOfLoanID, EmploymentTypeID, SalutationID, Gender,
 *              QualificationID, Address.AddressTypeID, Address.ResidentType
 *   - Changed: MiddleName now extracted from user.name (was hardcoded "NA")
 *              Gender now uses LOS IDs (45/46) instead of old 1/2
 *              AdharDrivingNo now from aadhaarVerification (was hardcoded "NA")
 *
 * @param {object} application        - Prisma LoanApplication record
 * @param {object} user               - Prisma User record
 * @param {object} kycEmployment      - Prisma EmploymentDetail record (or null)
 * @param {object} kycAddress         - Prisma AddressDetail record (or null)
 * @param {object} panVerification    - Prisma PanVerification record (or null)
 * @param {object} aadhaarVerification - Prisma AadhaarVerification record (or null)
 * @returns {object}                  - LOS-ready payload
 */
const buildNewLosPayload = (application, user, kycEmployment, kycAddress, panVerification, aadhaarVerification, isReloan = false,employee) => {
    const appId = application?.id || 'UNKNOWN';
    logger.info(`[LOS MAPPING] Building payload for applicationId: ${appId}`);

    // ── Log input data availability ─────────────────────────────────────
    logger.info(`[LOS MAPPING] Input data status:`, {
        monthyIncome:       employee.monthlyIncome || 0,
        applicationId:      appId,
        hasUser:            !!user,
        userName:           user?.name ? `${user.name.charAt(0)}***` : 'MISSING',
        userGender:         user?.gender || 'MISSING',
        userPhone:          user?.phone ? `******${user.phone.slice(-4)}` : 'MISSING',
        userEmail:          user?.email ? `***@${user.email.split('@')[1] || '***'}` : 'MISSING',
        userDob:            user?.dob ? 'present' : 'MISSING',
        hasEmployment:      !!kycEmployment,
        employmentType:     kycEmployment?.employmentType || 'MISSING',
        hasAddress:         !!kycAddress,
        addressState:       kycAddress?.state || 'MISSING',
        addressType:        kycAddress?.currentAddressType || 'MISSING',
        hasPan:             !!panVerification,
        panNumber:          panVerification?.panNumber ? `${panVerification.panNumber.substring(0, 4)}****` : 'MISSING',
        hasAadhaar:         !!aadhaarVerification,
        aadhaarNumber:      aadhaarVerification?.aadhaarNumber ? `****${aadhaarVerification.aadhaarNumber.slice(-4)}` : 'MISSING',
        loanType:           application?.loanType || 'MISSING',
        loanAmount:         application?.loanAmount || 'MISSING'
    });

    // ── Name extraction (3-part split: First / Middle / Last) ────────────
    const nameParts = (user.name || '').trim().split(/\s+/);
    let firstName, middleName, lastName;

    if (nameParts.length >= 3) {
        firstName  = nameParts[0];
        middleName = nameParts.slice(1, -1).join(' ');
        lastName   = nameParts[nameParts.length - 1];
    } else if (nameParts.length === 2) {
        firstName  = nameParts[0];
        middleName = 'NA';
        lastName   = nameParts[1];
        logger.warn(`[LOS MAPPING] appId=${appId} — 2-part name detected, MiddleName defaulted to 'NA'. Name: "${user.name?.charAt(0)}***"`);
    } else {
        firstName  = nameParts[0] || 'Unknown';
        middleName = 'NA';
        lastName   = 'Unknown';
        logger.warn(`[LOS MAPPING] appId=${appId} — Single/empty name detected. FirstName="${firstName?.charAt(0)}***", LastName defaulted to 'Unknown'.`);
    }

    // ── Date fields ─────────────────────────────────────────────────────
    const DateOfBirth = user.dob ? new Date(user.dob).toISOString() : '1997-01-20T10:38:43.468Z';
    if (!user.dob) {
        logger.warn(`[LOS MAPPING] appId=${appId} — DOB is missing, using hardcoded default: 1997-01-20`);
    }

    const paydayDate = new Date();
    paydayDate.setDate(paydayDate.getDate() + 30);
    const PayDayDateString = paydayDate.toISOString();

    // ── Enum lookups ────────────────────────────────────────────────────
    const employmentType = kycEmployment && kycEmployment.employmentType
        ? kycEmployment.employmentType
        : 'OTHER';
    const EmploymentTypeID = employmentMap[employmentType] || employmentMap.OTHER;
    if (!kycEmployment || !kycEmployment.employmentType) {
        logger.warn(`[LOS MAPPING] appId=${appId} — Employment data missing, defaulting EmploymentTypeID to ${EmploymentTypeID} (OTHER→SALARIED)`);
    } else if (!employmentMap[employmentType]) {
        logger.warn(`[LOS MAPPING] appId=${appId} — Unknown employmentType "${employmentType}", defaulting EmploymentTypeID to ${EmploymentTypeID}`);
    }

    const gender = user.gender || 'PREFER_NOT_TO_SAY';
    const SalutationID = salutationMap[gender] || salutationMap.PREFER_NOT_TO_SAY;
    const Gender = genderMap[gender] || genderMap.PREFER_NOT_TO_SAY;
    if (!user.gender) {
        logger.warn(`[LOS MAPPING] appId=${appId} — Gender missing, defaulting SalutationID=${SalutationID}, Gender=${Gender}`);
    }

    const loanType = application.loanType || 'OTHER';
    const PurposeOfLoanID = purposeOfLoanMap[loanType] || purposeOfLoanMap.OTHER;
    if (!application.loanType) {
        logger.warn(`[LOS MAPPING] appId=${appId} — loanType missing, defaulting PurposeOfLoanID to ${PurposeOfLoanID} (OTHER)`);
    } else if (!purposeOfLoanMap[loanType]) {
        logger.warn(`[LOS MAPPING] appId=${appId} — Unknown loanType "${loanType}", defaulting PurposeOfLoanID to ${PurposeOfLoanID}`);
    }

    // ── Address lookups ─────────────────────────────────────────────────
    const StateCode = kycAddress && kycAddress.state
        ? (stateMap[kycAddress.state] || 1059)
        : 1059;
    if (!kycAddress || !kycAddress.state) {
        logger.warn(`[LOS MAPPING] appId=${appId} — Address state missing, defaulting StateID to 1059`);
    } else if (!stateMap[kycAddress.state]) {
        logger.warn(`[LOS MAPPING] appId=${appId} — Unknown state "${kycAddress.state}", defaulting StateID to 1059. Check stateMap.`);
    }

    const addressType = kycAddress && kycAddress.currentAddressType
        ? kycAddress.currentAddressType
        : null;
    const ResidentType = addressType
        ? (residentTypeMap[addressType] || residentTypeMap.OWNER_SELF_OR_FAMILY)
        : residentTypeMap.OWNER_SELF_OR_FAMILY;
    if (!addressType) {
        logger.warn(`[LOS MAPPING] appId=${appId} — currentAddressType missing, defaulting ResidentType to ${ResidentType} (OWNER)`);
    }

    // ── KYC field logging ───────────────────────────────────────────────
    if (!panVerification || !panVerification.panNumber) {
        logger.warn(`[LOS MAPPING] appId=${appId} — PAN not verified, PanSSN will be 'NA'`);
    }
    if(!employee || !employee.monthlyIncome) {
        logger.warn(`[LOS MAPPING] appId=${appId} — MonthlyIncome not verified, TotalMonthlyIncome will be '0'`);
    }
    if (!aadhaarVerification || !aadhaarVerification.aadhaarNumber) {
        logger.warn(`[LOS MAPPING] appId=${appId} — Aadhaar not verified, AdharDrivingNo will be 'NA'`);
    }
    if (!user.phone) {
        logger.warn(`[LOS MAPPING] appId=${appId} — Phone missing, MobileNo will be '0000000000'`);
    }
    if (!user.email) {
        logger.warn(`[LOS MAPPING] appId=${appId} — Email missing, will use phone-based fallback email`);
    }
    if (!application.loanAmount) {
        logger.warn(`[LOS MAPPING] appId=${appId} — loanAmount missing, defaulting to 5000`);
    }

    // ── Build payload ───────────────────────────────────────────────────
    const payload = {
        ProductID:          isReloan ? 14 : 13,
        LoanAmountRequired: application.loanAmount || 5000,
        PayDayDate:         PayDayDateString,
        TotalMonthlyIncome: employee.monthlyIncome || 0,
        
        PurposeOfLoanID,
        EmploymentTypeID,
        SalutationID,
        Gender,
        QualificationID: QUALIFICATION_ID,

        FirstName:    losClean(firstName)  || 'Unknown',
        MiddleName:   losClean(middleName) || 'NA',
        LastName:     losClean(lastName)   || 'Unknown',
        DateOfBirth,

        MobileNo:       losPhone(user.phone),
        Email:          losClean(user.email) || `${losPhone(user.phone)}@noemail.com`,
        PanSSN:         panVerification && panVerification.panNumber ? losClean(panVerification.panNumber) : 'NA',
        AdharDrivingNo: aadhaarVerification && aadhaarVerification.aadhaarNumber
            ? losClean(aadhaarVerification.aadhaarNumber.replace(/_DUP_\d+$/, ''))
            : 'NA',

        Address: {
            AddressTypeID: addressTypeMap.COMMUNICATION,   // 334 — LOS expects COMMUNICATION type
            ResidentType,
            AddressLine1:  kycAddress && kycAddress.currentAddress ? losClean(kycAddress.currentAddress) : 'NA',
            StateID:       StateCode,
            PinZipCode:    kycAddress && kycAddress.postalCode ? losClean(kycAddress.postalCode) : '000000',
            PhoneNo:       losPhone(user.phone)
        }
    };

    // ── Log the complete outgoing payload (sanitized) ────────────────────
    logger.info(`[LOS MAPPING] ✅ Payload built successfully for appId=${appId}`, {
        payload: {
            ...payload,
            PanSSN:         payload.PanSSN !== 'NA' ? `${payload.PanSSN.substring(0, 4)}******` : 'NA',
            AdharDrivingNo: payload.AdharDrivingNo !== 'NA' ? `********${payload.AdharDrivingNo.slice(-4)}` : 'NA',
            MobileNo:       `******${payload.MobileNo.slice(-4)}`
        }
    });

    // Validate payload before sending — log any dangerous characters that slipped through
    validatePayload(payload, appId);

    return payload;
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * LEGACY LOS PAYLOAD BUILDER (v1 – kept for rollback safety)
 * ─────────────────────────────────────────────────────────────────────────────
 * Builds the old-format LOS JSON payload. No longer used in production
 * but retained so we can quickly rollback if the new contract has issues.
 */
const buildLosPayloadLegacy = (application, user, kycEmployment, kycAddress, panVerification) => {
    // Basic null checks
    const nameParts = user.name ? user.name.split(' ') : ['Unknown'];
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Unknown';

    const DateOfBirth = user.dob ? new Date(user.dob).toISOString() : "1997-01-20T10:38:43.468Z";
    
    // Dummy payday date
    const paydayDate = new Date();
    paydayDate.setDate(paydayDate.getDate() + 30);
    const PaydayDateString = paydayDate.toISOString();

    const StateCode = kycAddress && kycAddress.state ? (stateMap[kycAddress.state] || 1059) : 1059;

    return {
        OrganizationID: 1,
        LoanTypeID: 16,
        ProductSchemeName: "PayDay Loan Scheme",
        FirstName: firstName || "Unknown",
        MiddleName: "NA",
        LastName: lastName || "Unknown",
        DateOfBirth: DateOfBirth,
        MobileNo: user.phone || "0000000000",
        Email: user.email || `${user.phone}@noemail.com`,
        PanSSN: panVerification && panVerification.panNumber ? panVerification.panNumber : "NA",
        AdharDrivingNo: "NA",
        LoanCategoryCode: "RLT",
        ProductCategoryCode: "UNSEC",
        ProductID: 13,
        ProductName: "PayDay Loan",
        LoanAmountRequired: application.loanAmount || 5000,
        Tenure: application.loanPeriod || 10,
        InterestRate: 6,
        PayCheckAmt: kycEmployment ? parseInt(kycEmployment.monthlyIncome || 50000, 10) : 50000,
        PayDayDate: PaydayDateString,

        Address: {
            AddressLine1: kycAddress && kycAddress.currentAddress ? kycAddress.currentAddress : "NA",
            CityName: kycAddress && kycAddress.city ? kycAddress.city : "NA",
            StateID: StateCode,
            PinZipCode: kycAddress && kycAddress.postalCode ? kycAddress.postalCode : "000000",
            PhoneNo: user.phone || "0000000000"
        },

        KYC_Individual: {
            FirstName: firstName || "Unknown",
            MiddleName: "NA",
            LastName: lastName || "Unknown",
            MobileNo: user.phone || "0000000000",
            Email: user.email || `${user.phone}@noemail.com`,
            PanSSN: panVerification && panVerification.panNumber ? panVerification.panNumber : "NA",
            AdharDrivingNo: "NA"
        },

        IsJointApplication: true,
        IsCoBorrower: true
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// 7. Document Type Mapping (Confirmed by LOS team)
// ─────────────────────────────────────────────────────────────────────────────
const documentTypeMap = {
    PAN:             { DocID: 2011, DocTypeID: 1 },
    AADHAAR:         { DocID: 2014, DocTypeID: 1 }, // Map default Aadhaar to Front Side
    PAY_SLIP:        { DocID: 73,   DocTypeID: 3 },
    BANK_STATEMENT:  { DocID: 3023, DocTypeID: 3 }, // STMT
    PHOTO:           { DocID: 0,    DocTypeID: 0 }, // Not specified
    SIGNATURE:       { DocID: 0,    DocTypeID: 0 }, // Not specified
    GST_CERTIFICATE: { DocID: 0,    DocTypeID: 0 }, // Not specified
    TRADE_LICENSE:   { DocID: 0,    DocTypeID: 0 }, // Not specified
    COMPANY_PAN:     { DocID: 0,    DocTypeID: 0 }, // Not specified
};

module.exports = {
    employmentMap,
    salutationMap,
    genderMap,
    purposeOfLoanMap,
    addressTypeMap,
    residentTypeMap,
    stateMap,
    documentTypeMap,
    QUALIFICATION_ID,
    calculateAge,
    losClean,
    losPhone,
    validatePayload,
    buildNewLosPayload,       // New LOS contract (active)
    buildLosPayloadLegacy     // v1 legacy (kept for rollback)
};
