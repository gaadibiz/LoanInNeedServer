/**
 * Mappings for LOS Enums and Data Transformation
 *
 * Updated: June 2026 — Aligned with the new LOS SaveNewApplication contract.
 * See: LOS Integration Documentation § "New SaveNewApplication Payload"
 */

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
// 2. Salutation Mapping  (Confirmed by LOS team — replaces old genderMap)
//    Derived from user's gender. No separate Gender field in the new contract.
//    FEMALE has multiple options (274=Mrs., 275=Miss, 276=Ms.);
//    we default to 274 since we don't collect marital status.
// ─────────────────────────────────────────────────────────────────────────────
const salutationMap = {
    MALE:              273,   // Mr.
    FEMALE:            274,   // Mrs. (default for female; 275=Miss, 276=Ms. also valid)
    PREFER_NOT_TO_SAY: 273    // Defaulting to Mr.
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. Purpose of Loan Mapping  (Partially confirmed by LOS team)
//    4 of 8 values mapped. Unmapped types default to OTHER (53).
//    TODO: Update once LOS provides IDs for EDUCATION, DEBT_CONSOLIDATION,
//          WEDDING, and BUSINESS.
// ─────────────────────────────────────────────────────────────────────────────
const purposeOfLoanMap = {
    MEDICAL_EMERGENCY:  49,
    EDUCATION:          53,   // Not yet mapped by LOS — defaulting to OTHER
    HOME_RENOVATION:    51,
    DEBT_CONSOLIDATION: 53,   // Not yet mapped by LOS — defaulting to OTHER
    WEDDING:            53,   // Not yet mapped by LOS — defaulting to OTHER
    BUSINESS:           53,   // Not yet mapped by LOS — defaulting to OTHER
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
 *              Address.CityName, KYC_Individual, IsJointApplication, IsCoBorrower,
 *              Gender, QualificationID
 *   - Added:   PurposeOfLoanID, EmploymentTypeID, SalutationID,
 *              Address.AddressTypeID, Address.ResidentType
 *   - Changed: MiddleName now extracted from user.name (was hardcoded "NA")
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
const buildNewLosPayload = (application, user, kycEmployment, kycAddress, panVerification, aadhaarVerification) => {
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
    } else {
        firstName  = nameParts[0] || 'Unknown';
        middleName = 'NA';
        lastName   = 'Unknown';
    }

    // ── Date fields ─────────────────────────────────────────────────────
    const DateOfBirth = user.dob ? new Date(user.dob).toISOString() : '1997-01-20T10:38:43.468Z';

    const paydayDate = new Date();
    paydayDate.setDate(paydayDate.getDate() + 30);
    const PayDayDateString = paydayDate.toISOString();

    // ── Enum lookups ────────────────────────────────────────────────────
    const employmentType = kycEmployment && kycEmployment.employmentType
        ? kycEmployment.employmentType
        : 'OTHER';
    const EmploymentTypeID = employmentMap[employmentType] || employmentMap.OTHER;

    const gender = user.gender || 'PREFER_NOT_TO_SAY';
    const SalutationID = salutationMap[gender] || salutationMap.PREFER_NOT_TO_SAY;

    const loanType = application.loanType || 'OTHER';
    const PurposeOfLoanID = purposeOfLoanMap[loanType] || purposeOfLoanMap.OTHER;

    // ── Address lookups ─────────────────────────────────────────────────
    const StateCode = kycAddress && kycAddress.state
        ? (stateMap[kycAddress.state] || 1059)
        : 1059;

    const addressType = kycAddress && kycAddress.currentAddressType
        ? kycAddress.currentAddressType
        : null;
    const ResidentType = addressType
        ? (residentTypeMap[addressType] || residentTypeMap.OWNER_SELF_OR_FAMILY)
        : residentTypeMap.OWNER_SELF_OR_FAMILY;

    // ── Build payload ───────────────────────────────────────────────────
    return {
        ProductID:          13,
        LoanAmountRequired: application.loanAmount || 5000,
        PayDayDate:         PayDayDateString,

        PurposeOfLoanID,
        EmploymentTypeID,
        SalutationID,

        FirstName:    firstName  || 'Unknown',
        MiddleName:   middleName || 'NA',
        LastName:     lastName   || 'Unknown',
        DateOfBirth,

        MobileNo:       user.phone || '0000000000',
        Email:          user.email || `${user.phone}@noemail.com`,
        PanSSN:         panVerification && panVerification.panNumber ? panVerification.panNumber : 'NA',
        AdharDrivingNo: aadhaarVerification && aadhaarVerification.aadhaarNumber
            ? aadhaarVerification.aadhaarNumber
            : 'NA',

        Address: {
            AddressTypeID: addressTypeMap.CURRENT,   // 335 — we always send current address
            ResidentType,
            AddressLine1:  kycAddress && kycAddress.currentAddress ? kycAddress.currentAddress : 'NA',
            StateID:       StateCode,
            PinZipCode:    kycAddress && kycAddress.postalCode ? kycAddress.postalCode : '000000',
            PhoneNo:       user.phone || '0000000000'
        }
    };
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

module.exports = {
    employmentMap,
    salutationMap,
    purposeOfLoanMap,
    addressTypeMap,
    residentTypeMap,
    stateMap,
    calculateAge,
    buildNewLosPayload,       // New LOS contract (active)
    buildLosPayloadLegacy     // v1 legacy (kept for rollback)
};
