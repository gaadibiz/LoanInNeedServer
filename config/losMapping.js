/**
 * Mappings for LOS Enums and Data Transformation
 */

// 1. Gender Mapping
const genderMap = {
    MALE: 45,
    FEMALE: 46,
    PREFER_NOT_TO_SAY: 45 // Defaulting to Male if unknown per typical legacy system reqs, or can pass null if allowed
};

// 2. Employment Type Mapping
const employmentMap = {
    SALARIED: 342,
    SELF_EMPLOYED: 343,
    STUDENT: 344,
    UNEMPLOYED: 345,
    OTHER: 345
};

// 3. State Mapping (Approximation based on standard codes, adjust if a master list is provided by LOS)
const stateMap = {
    "West Bengal": 1059,
    "Maharashtra": 1060,
    "Delhi": 1061,
    "Karnataka": 1062,
    // Add more states as needed... default 1059 for fallback if missing
};

/**
 * Builds the LOS JSON payload from LIN DB structures
 */
const buildLosPayload = (application, user, kycEmployment, kycAddress, kycPan) => {
    // Basic null checks
    const firstName = user.name ? user.name.split(' ')[0] : 'Unknown';
    const lastName = user.name && user.name.includes(' ') ? user.name.split(' ').slice(1).join(' ') : 'Unknown';

    // Default system fields
    const OrganizationID = 1;
    const LoanCategoryCode = "RLT";
    const ProductCategoryCode = "UNSEC";
    const ProductName = "PayDay Loan";
    const LoanTypeID = 16;
    const ProductID = 14;
    const ProductSchemeID = 1006;

    // Mapped Values
    const Gender = genderMap[user.gender] || 45;
    const EmploymentTypeID = kycEmployment ? (employmentMap[kycEmployment.employmentType] || 342) : 342;
    const StateID = kycAddress && kycAddress.state ? (stateMap[kycAddress.state] || 1059) : 1059;

    // Formatting Dates
    const DateOfBirth = user.dob ? user.dob.toISOString() : new Date().toISOString();

    return {
        // System and Config Fields
        OrganizationID,
        LoanCategoryCode,
        ProductCategoryCode,
        ProductName,
        LoanTypeID,
        ProductID,
        ProductSchemeID,

        // Personal Information
        FirstName: firstName,
        LastName: lastName,
        MobileNo: user.phone,
        Email: user.email || `${user.phone}@noemail.com`,
        DateOfBirth: DateOfBirth,
        Gender: Gender,

        // Identity
        PanSSN: kycPan ? kycPan.panNumber : "",
        AdharDrivingNo: "", // Extract from Aadhaar verification if available

        // Employment
        EmploymentTypeID: EmploymentTypeID,
        PayCheckAmt: kycEmployment ? (kycEmployment.monthlyIncome || 0) : 0,

        // Loan Details
        LoanAmountRequired: application.loanAmount || 0,
        PurposeOfLoanID: 1, // Defaulting if not strictly mapped in LIN yet
        Tenure: 12, // Defaulting 

        // Address Details 
        Address: {
            AddressLine1: kycAddress ? (kycAddress.currentAddress || "") : "",
            CityName: kycAddress ? (kycAddress.city || "") : "",
            StateID: StateID,
            PinZipCode: kycAddress ? (kycAddress.postalCode || "") : ""
        },

        // KYC Individual Block (Often required redundantly by LOS)
        KyCIndividual: {
            FirstName: firstName,
            LastName: lastName,
            MobileNo: user.phone,
            Email: user.email || `${user.phone}@noemail.com`,
            PanSSN: kycPan ? kycPan.panNumber : "",
            AdharDrivingNo: ""
        }
    };
};

module.exports = {
    genderMap,
    employmentMap,
    stateMap,
    buildLosPayload
};
