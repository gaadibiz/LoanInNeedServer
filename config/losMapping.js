/**
 * Mappings for LOS Enums and Data Transformation
 */

// 1. Gender Mapping
const genderMap = {
    MALE: 1,
    FEMALE: 2,
    PREFER_NOT_TO_SAY: 1 // Default to Male per table
};

// 2. Employment Type Mapping
const employmentMap = {
    SALARIED: 342,
    SELF_EMPLOYED: 343,
    STUDENT: 344,
    UNEMPLOYED: 345,
    OTHER: 345
};

// 3. State Mapping (From table)
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
 * NEW LOS PAYLOAD BUILDER (v2 – matches the LOS team's API contract)
 * ─────────────────────────────────────────────────────────────────────────────
 * Maps LIN database fields to the simple, clean JSON contract the LOS team
 * shared. This is what gets pushed to POST /api/v1/loan/applications.
 *
 * @param {object} application  - Prisma LoanApplication record
 * @param {object} user         - Prisma User record
 * @returns {object}            - LOS-ready payload
 */
const buildNewLosPayload = (application, user) => {
    const nameParts = (user.name || '').trim().split(' ');
    const firstName = nameParts[0] || 'Unknown';
    const lastName  = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Unknown';

    // Format applicationId as LIN/YYYY/NNNNN  (e.g. LIN/2026/00021)
    const year = new Date(application.createdAt).getFullYear();
    const seqNum = String(application.id).padStart(5, '0');
    const applicationId = `LIN/${year}/${seqNum}`;

    // Derive loan product label
    const loanTypeToProduct = {
        PAYDAY:    'Payday',
        PERSONAL:  'Personal',
        BUSINESS:  'Business',
        OTHER:     'Payday'   // default to Payday as per LOS team expectation
    };
    const product = loanTypeToProduct[(application.loanType || 'PAYDAY').toUpperCase()] || 'Payday';

    return {
        applicationId,
        customer: {
            firstName,
            lastName,
            mobile: user.phone  || '',
            email:  user.email  || ''
        },
        loanDetails: {
            product,
            amount:  application.loanAmount || 0,
            tenure:  30,            // Default 30-day payday tenure
            emiType: 'Single EMI'   // Standard for payday loans
        },
        source:    'WebApp',
        timestamp: new Date().toISOString()
    };
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * LEGACY LOS PAYLOAD BUILDER (v1 – kept for backward compatibility)
 * ─────────────────────────────────────────────────────────────────────────────
 * Builds the LOS JSON payload from LIN DB structures
 */
const buildLosPayload = (application, user, kycEmployment, kycAddress, panVerification) => {
    // Basic null checks
    const nameParts = user.name ? user.name.split(' ') : ['Unknown'];
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Unknown';
    const age = calculateAge(user.dob);

    const DateOfBirth = user.dob ? new Date(user.dob).toISOString() : new Date().toISOString();
    
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
        LoanAmountRequired: application.loanAmount || 0,
        Tenure: application.loanPeriod || 10,
        InterestRate: 6,
        PayCheckAmt: kycEmployment ? (kycEmployment.monthlyIncome || 0) : 0,
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
    genderMap,
    employmentMap,
    stateMap,
    buildLosPayload,       // v1 – legacy (kept for reference)
    buildNewLosPayload     // v2 – new LOS team contract
};
