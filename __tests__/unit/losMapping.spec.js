/**
 * Unit tests for losMapping.js — buildNewLosPayload()
 *
 * Tests the new LOS payload builder against the confirmed contract (June 2026).
 */

const {
    employmentMap,
    salutationMap,
    genderMap,
    purposeOfLoanMap,
    addressTypeMap,
    residentTypeMap,
    stateMap,
    QUALIFICATION_ID,
    buildNewLosPayload,
    buildLosPayloadLegacy
} = require('../../config/losMapping');

// ─────────────────────────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────────────────────────
const makeUser = (overrides = {}) => ({
    name: 'Sourabh Suresh Thakre',
    phone: '7721815360',
    email: 'test@gmail.com',
    dob: new Date('1995-04-13T11:06:33.710Z'),
    gender: 'MALE',
    ...overrides
});

const makeApplication = (overrides = {}) => ({
    id: 1,
    loanAmount: 10000,
    loanType: 'MEDICAL_EMERGENCY',
    ...overrides
});

const makeEmployment = (overrides = {}) => ({
    employmentType: 'SALARIED',
    monthlyIncome: 50000,
    ...overrides
});

const makeAddress = (overrides = {}) => ({
    currentAddress: 'IT Park',
    city: 'Nagpur',
    state: 'Delhi',
    postalCode: '444607',
    currentAddressType: 'OWNER_SELF_OR_FAMILY',
    ...overrides
});

const makePan = (overrides = {}) => ({
    panNumber: 'DWDPS7125Z',
    ...overrides
});

const makeAadhaar = (overrides = {}) => ({
    aadhaarNumber: '987654356782',
    ...overrides
});

// ─────────────────────────────────────────────────────────────────────────────
// Mapping table tests
// ─────────────────────────────────────────────────────────────────────────────
describe('LOS Mapping Tables', () => {
    describe('employmentMap', () => {
        it('should map SALARIED to 342', () => {
            expect(employmentMap.SALARIED).toBe(342);
        });

        it('should map SELF_EMPLOYED to 343', () => {
            expect(employmentMap.SELF_EMPLOYED).toBe(343);
        });

        it('should map STUDENT to 345 (corrected from 344)', () => {
            expect(employmentMap.STUDENT).toBe(345);
        });

        it('should map UNEMPLOYED to 346 (corrected from 345)', () => {
            expect(employmentMap.UNEMPLOYED).toBe(346);
        });

        it('should map OTHER to 342 (default to SALARIED)', () => {
            expect(employmentMap.OTHER).toBe(342);
        });
    });

    describe('salutationMap', () => {
        it('should map MALE to 273 (Mr.)', () => {
            expect(salutationMap.MALE).toBe(273);
        });

        it('should map FEMALE to 274 (Mrs.)', () => {
            expect(salutationMap.FEMALE).toBe(274);
        });

        it('should map PREFER_NOT_TO_SAY to 273 (default to Mr.)', () => {
            expect(salutationMap.PREFER_NOT_TO_SAY).toBe(273);
        });
    });

    describe('purposeOfLoanMap', () => {
        it('should map MEDICAL_EMERGENCY to 49', () => {
            expect(purposeOfLoanMap.MEDICAL_EMERGENCY).toBe(49);
        });

        it('should map EDUCATION to 48', () => {
            expect(purposeOfLoanMap.EDUCATION).toBe(48);
        });

        it('should map HOME_RENOVATION to 51', () => {
            expect(purposeOfLoanMap.HOME_RENOVATION).toBe(51);
        });

        it('should map DEBT_CONSOLIDATION to 50', () => {
            expect(purposeOfLoanMap.DEBT_CONSOLIDATION).toBe(50);
        });

        it('should map WEDDING to 101', () => {
            expect(purposeOfLoanMap.WEDDING).toBe(101);
        });

        it('should map BUSINESS to 102', () => {
            expect(purposeOfLoanMap.BUSINESS).toBe(102);
        });

        it('should map TRAVEL to 52', () => {
            expect(purposeOfLoanMap.TRAVEL).toBe(52);
        });

        it('should map OTHER to 53', () => {
            expect(purposeOfLoanMap.OTHER).toBe(53);
        });
    });

    describe('genderMap', () => {
        it('should map MALE to 45', () => {
            expect(genderMap.MALE).toBe(45);
        });

        it('should map FEMALE to 46', () => {
            expect(genderMap.FEMALE).toBe(46);
        });

        it('should map PREFER_NOT_TO_SAY to 45 (default to MALE)', () => {
            expect(genderMap.PREFER_NOT_TO_SAY).toBe(45);
        });
    });

    describe('addressTypeMap', () => {
        it('should map COMMUNICATION to 334', () => {
            expect(addressTypeMap.COMMUNICATION).toBe(334);
        });

        it('should map CURRENT to 335', () => {
            expect(addressTypeMap.CURRENT).toBe(335);
        });

        it('should map PERMANENT to 336', () => {
            expect(addressTypeMap.PERMANENT).toBe(336);
        });
    });

    describe('residentTypeMap', () => {
        it('should map OWNER_SELF_OR_FAMILY to 319', () => {
            expect(residentTypeMap.OWNER_SELF_OR_FAMILY).toBe(319);
        });

        it('should map RENTED to 318', () => {
            expect(residentTypeMap.RENTED).toBe(318);
        });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildNewLosPayload tests
// ─────────────────────────────────────────────────────────────────────────────
describe('buildNewLosPayload', () => {
    describe('Full data (happy path)', () => {
        let payload;

        beforeAll(() => {
            payload = buildNewLosPayload(
                makeApplication(),
                makeUser(),
                makeEmployment(),
                makeAddress(),
                makePan(),
                makeAadhaar()
            );
        });

        // ── Top-level fields ────────────────────────────────────────────
        it('should set ProductID to 13', () => {
            expect(payload.ProductID).toBe(13);
        });

        it('should set LoanAmountRequired from application', () => {
            expect(payload.LoanAmountRequired).toBe(10000);
        });

        it('should set PayDayDate as ISO string (30 days from now)', () => {
            expect(payload.PayDayDate).toBeDefined();
            const payDay = new Date(payload.PayDayDate);
            const now = new Date();
            const diffDays = Math.round((payDay - now) / (1000 * 60 * 60 * 24));
            expect(diffDays).toBeGreaterThanOrEqual(29);
            expect(diffDays).toBeLessThanOrEqual(31);
        });

        it('should set PurposeOfLoanID from loanType', () => {
            expect(payload.PurposeOfLoanID).toBe(49); // MEDICAL_EMERGENCY
        });

        it('should set EmploymentTypeID from employment', () => {
            expect(payload.EmploymentTypeID).toBe(342); // SALARIED
        });

        it('should set SalutationID from gender', () => {
            expect(payload.SalutationID).toBe(273); // MALE → Mr.
        });

        it('should set Gender from gender', () => {
            expect(payload.Gender).toBe(45); // MALE
        });

        it('should set QualificationID to static 314', () => {
            expect(payload.QualificationID).toBe(314);
        });

        // ── Name extraction ─────────────────────────────────────────────
        it('should extract FirstName from 3-part name', () => {
            expect(payload.FirstName).toBe('Sourabh');
        });

        it('should extract MiddleName from 3-part name', () => {
            expect(payload.MiddleName).toBe('Suresh');
        });

        it('should extract LastName from 3-part name', () => {
            expect(payload.LastName).toBe('Thakre');
        });

        // ── Contact fields ──────────────────────────────────────────────
        it('should set MobileNo from user.phone', () => {
            expect(payload.MobileNo).toBe('7721815360');
        });

        it('should set Email from user.email', () => {
            expect(payload.Email).toBe('test@gmail.com');
        });

        it('should set PanSSN from panVerification', () => {
            expect(payload.PanSSN).toBe('DWDPS7125Z');
        });

        it('should set AdharDrivingNo from aadhaarVerification', () => {
            expect(payload.AdharDrivingNo).toBe('987654356782');
        });

        it('should set DateOfBirth as ISO string', () => {
            expect(payload.DateOfBirth).toContain('1995-04-13');
        });

        // ── Address block ───────────────────────────────────────────────
        it('should set Address.AddressTypeID to 335 (Current Address)', () => {
            expect(payload.Address.AddressTypeID).toBe(335);
        });

        it('should set Address.ResidentType from currentAddressType', () => {
            expect(payload.Address.ResidentType).toBe(319); // OWNER_SELF_OR_FAMILY
        });

        it('should set Address.AddressLine1 from currentAddress', () => {
            expect(payload.Address.AddressLine1).toBe('IT Park');
        });

        it('should set Address.StateID from state mapping', () => {
            expect(payload.Address.StateID).toBe(1121); // Delhi
        });

        it('should set Address.PinZipCode from postalCode', () => {
            expect(payload.Address.PinZipCode).toBe('444607');
        });

        it('should set Address.PhoneNo from user.phone', () => {
            expect(payload.Address.PhoneNo).toBe('7721815360');
        });

        // ── Removed fields should NOT be present ────────────────────────
        it('should NOT include OrganizationID', () => {
            expect(payload.OrganizationID).toBeUndefined();
        });

        it('should NOT include KYC_Individual', () => {
            expect(payload.KYC_Individual).toBeUndefined();
        });

        it('should NOT include IsJointApplication', () => {
            expect(payload.IsJointApplication).toBeUndefined();
        });

        it('should NOT include IsCoBorrower', () => {
            expect(payload.IsCoBorrower).toBeUndefined();
        });

        it('should NOT include Tenure', () => {
            expect(payload.Tenure).toBeUndefined();
        });

        it('should NOT include InterestRate', () => {
            expect(payload.InterestRate).toBeUndefined();
        });

        it('should NOT include Address.CityName', () => {
            expect(payload.Address.CityName).toBeUndefined();
        });
    });

    describe('Name splitting edge cases', () => {
        it('should handle 2-part name (FirstName + LastName, MiddleName = NA)', () => {
            const payload = buildNewLosPayload(
                makeApplication(), makeUser({ name: 'John Doe' }),
                null, null, null, null
            );
            expect(payload.FirstName).toBe('John');
            expect(payload.MiddleName).toBe('NA');
            expect(payload.LastName).toBe('Doe');
        });

        it('should handle single-word name', () => {
            const payload = buildNewLosPayload(
                makeApplication(), makeUser({ name: 'Madonna' }),
                null, null, null, null
            );
            expect(payload.FirstName).toBe('Madonna');
            expect(payload.MiddleName).toBe('NA');
            expect(payload.LastName).toBe('Unknown');
        });

        it('should handle 4-part name (multiple middle names)', () => {
            const payload = buildNewLosPayload(
                makeApplication(), makeUser({ name: 'Ravi Kumar Singh Patel' }),
                null, null, null, null
            );
            expect(payload.FirstName).toBe('Ravi');
            expect(payload.MiddleName).toBe('Kumar Singh');
            expect(payload.LastName).toBe('Patel');
        });

        it('should handle empty name', () => {
            const payload = buildNewLosPayload(
                makeApplication(), makeUser({ name: '' }),
                null, null, null, null
            );
            expect(payload.FirstName).toBe('Unknown');
            expect(payload.MiddleName).toBe('NA');
            expect(payload.LastName).toBe('Unknown');
        });

        it('should handle null name', () => {
            const payload = buildNewLosPayload(
                makeApplication(), makeUser({ name: null }),
                null, null, null, null
            );
            expect(payload.FirstName).toBe('Unknown');
            expect(payload.LastName).toBe('Unknown');
        });
    });

    describe('Fallback/default values', () => {
        it('should default AdharDrivingNo to NA when aadhaar not verified', () => {
            const payload = buildNewLosPayload(
                makeApplication(), makeUser(), makeEmployment(),
                makeAddress(), makePan(), null
            );
            expect(payload.AdharDrivingNo).toBe('NA');
        });

        it('should default PanSSN to NA when PAN not verified', () => {
            const payload = buildNewLosPayload(
                makeApplication(), makeUser(), makeEmployment(),
                makeAddress(), null, null
            );
            expect(payload.PanSSN).toBe('NA');
        });

        it('should default EmploymentTypeID to 342 when employment is null', () => {
            const payload = buildNewLosPayload(
                makeApplication(), makeUser(), null,
                makeAddress(), makePan(), makeAadhaar()
            );
            expect(payload.EmploymentTypeID).toBe(342); // defaults to SALARIED via OTHER
        });

        it('should default SalutationID to 273 when gender is missing', () => {
            const payload = buildNewLosPayload(
                makeApplication(), makeUser({ gender: null }),
                null, null, null, null
            );
            expect(payload.SalutationID).toBe(273);
        });

        it('should set SalutationID to 274 for FEMALE', () => {
            const payload = buildNewLosPayload(
                makeApplication(), makeUser({ gender: 'FEMALE' }),
                null, null, null, null
            );
            expect(payload.SalutationID).toBe(274);
        });

        it('should default Address fields when address is null', () => {
            const payload = buildNewLosPayload(
                makeApplication(), makeUser(), makeEmployment(),
                null, makePan(), makeAadhaar()
            );
            expect(payload.Address.AddressLine1).toBe('NA');
            expect(payload.Address.PinZipCode).toBe('000000');
            expect(payload.Address.ResidentType).toBe(319); // defaults to OWNER
        });

        it('should default LoanAmountRequired to 5000 when missing', () => {
            const payload = buildNewLosPayload(
                makeApplication({ loanAmount: null }), makeUser(),
                null, null, null, null
            );
            expect(payload.LoanAmountRequired).toBe(5000);
        });

        it('should map PurposeOfLoanID for EDUCATION to 48', () => {
            const payload = buildNewLosPayload(
                makeApplication({ loanType: 'EDUCATION' }), makeUser(),
                null, null, null, null
            );
            expect(payload.PurposeOfLoanID).toBe(48);
        });

        it('should default PurposeOfLoanID to 53 (OTHER) for unknown types', () => {
            const payload = buildNewLosPayload(
                makeApplication({ loanType: 'UNKNOWN_TYPE' }), makeUser(),
                null, null, null, null
            );
            expect(payload.PurposeOfLoanID).toBe(53);
        });

        it('should set Gender to 46 for FEMALE', () => {
            const payload = buildNewLosPayload(
                makeApplication(), makeUser({ gender: 'FEMALE' }),
                null, null, null, null
            );
            expect(payload.Gender).toBe(46);
        });

        it('should default Gender to 45 when gender is missing', () => {
            const payload = buildNewLosPayload(
                makeApplication(), makeUser({ gender: null }),
                null, null, null, null
            );
            expect(payload.Gender).toBe(45);
        });

        it('should always set QualificationID to 314', () => {
            const payload = buildNewLosPayload(
                makeApplication(), makeUser(),
                null, null, null, null
            );
            expect(payload.QualificationID).toBe(314);
        });

        it('should map RENTED address type to ResidentType 318', () => {
            const payload = buildNewLosPayload(
                makeApplication(), makeUser(), makeEmployment(),
                makeAddress({ currentAddressType: 'RENTED' }),
                makePan(), makeAadhaar()
            );
            expect(payload.Address.ResidentType).toBe(318);
        });
    });

    describe('Payload structure validation', () => {
        it('should produce exactly the expected top-level keys', () => {
            const payload = buildNewLosPayload(
                makeApplication(), makeUser(), makeEmployment(),
                makeAddress(), makePan(), makeAadhaar()
            );

            const expectedKeys = [
                'ProductID', 'LoanAmountRequired', 'PayDayDate',
                'PurposeOfLoanID', 'EmploymentTypeID', 'SalutationID',
                'Gender', 'QualificationID',
                'FirstName', 'MiddleName', 'LastName', 'DateOfBirth',
                'MobileNo', 'Email', 'PanSSN', 'AdharDrivingNo',
                'Address'
            ];
            expect(Object.keys(payload).sort()).toEqual(expectedKeys.sort());
        });

        it('should produce exactly the expected Address keys', () => {
            const payload = buildNewLosPayload(
                makeApplication(), makeUser(), makeEmployment(),
                makeAddress(), makePan(), makeAadhaar()
            );

            const expectedAddressKeys = [
                'AddressTypeID', 'ResidentType', 'AddressLine1',
                'StateID', 'PinZipCode', 'PhoneNo'
            ];
            expect(Object.keys(payload.Address).sort()).toEqual(expectedAddressKeys.sort());
        });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Legacy builder — basic smoke test to ensure it still works for rollback
// ─────────────────────────────────────────────────────────────────────────────
describe('buildLosPayloadLegacy', () => {
    it('should still produce the old payload structure for rollback', () => {
        const payload = buildLosPayloadLegacy(
            makeApplication(), makeUser(), makeEmployment(),
            makeAddress(), makePan()
        );

        // Check legacy-specific fields exist
        expect(payload.OrganizationID).toBe(1);
        expect(payload.LoanTypeID).toBe(16);
        expect(payload.KYC_Individual).toBeDefined();
        expect(payload.IsJointApplication).toBe(true);
        expect(payload.IsCoBorrower).toBe(true);
        expect(payload.ProductSchemeName).toBe('PayDay Loan Scheme');
    });
});
