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
 * Builds the LOS JSON payload from LIN DB structures
 */
const buildLosPayload = (application, user, kycEmployment, kycAddress, kycPan) => {
    // Basic null checks
    const firstName = user.name ? user.name.split(' ')[0] : 'Unknown';
    const lastName = user.name && user.name.includes(' ') ? user.name.split(' ').slice(1).join(' ') : 'Unknown';
    const age = calculateAge(user.dob);

    // Formatting Dates
    const DateOfBirth = user.dob ? new Date(user.dob).toISOString() : new Date().toISOString();
    // Dummy payday date
    const paydayDate = new Date();
    paydayDate.setDate(paydayDate.getDate() + 30);
    const PaydayDateString = paydayDate.toISOString();

    const StateCode = kycAddress && kycAddress.state ? (stateMap[kycAddress.state] || 1109) : 1109; // Default 1109 (MH)
    const GenderCode = genderMap[user.gender] || 1;
    const EmploymentTypeID = kycEmployment ? (employmentMap[kycEmployment.employmentType] || 342) : 342;

    return {
        // 1-9 Organization & Product
        OrganizationID: 1,
        ProfileType: "I",
        ProductCategoryCode: "Unsecured",
        LoanTypeID: 16,
        ProductID: 13, // 13 for PayDay Loan
        ProductName: "PayDay Loan",
        ProductSchemeID: 1006,
        ProductSchemeName: "PayDay Loan Scheme",
        LoanCategoryCode: "RLT",

        // 10-13 Metrics & Options
        Age: age,
        Email: user.email || `${user.phone}@noemail.com`,
        QualificationID: null, // Select Qualification
        EligibleLoanAmount: application.loanAmount || 0, // Fallback to required

        // 14-16 Application Flags
        IsFormerAddress: false,
        IsJointApplication: false,
        IsCoBorrower: false,

        // 17-27 Personal & KYC
        FirstName: firstName,
        MiddleName: "",
        LastName: lastName,
        DateOfBirth: DateOfBirth,
        Gender: GenderCode,
        MobileNo: user.phone || "",
        EmploymentTypeID: EmploymentTypeID,
        NationalityID: 104,
        CitizenshipID: "India",
        Pan: kycPan ? kycPan.panNumber : "",
        AdharDrivingNo: "", // Extract or omit

        // 28-32 Loan specific
        LoanAmountRequired: application.loanAmount || 0,
        Tenure: 12, // Default
        InterestRate: 0, // Default passing 0
        PayCheckAmt: kycEmployment ? (kycEmployment.monthlyIncome || 0) : 0,
        PaydayDate: PaydayDateString,

        // 33-43 Address Block Let's keep it flat as decided
        AddressTypeID: 335,
        AddressLine1: kycAddress ? (kycAddress.currentAddress || "") : "",
        AddressLine2: "",
        DistrictName: kycAddress ? (kycAddress.city || "") : "",
        TalukaName: "",
        CityName: kycAddress ? (kycAddress.city || "") : "",
        StateID: StateCode,
        State: kycAddress ? (kycAddress.state || "Maharashtra") : "Maharashtra",
        PinZipCode: kycAddress ? (kycAddress.postalCode || "") : "",
        ResidentType: 319,
        IsCorrespondenceAddress: true,

        // 44
        CreatedBy: 1
    };
};

module.exports = {
    genderMap,
    employmentMap,
    stateMap,
    buildLosPayload
};
