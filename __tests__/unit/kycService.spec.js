/* eslint-env jest */
// Unit tests for services/kycService.js

// Mock prismaClient directly to ensure module require cache gets the mock
const mockTx = {
  loanApplication: {
    create: jest.fn().mockResolvedValue({ id: 999 }),
  },
  losIntegrationJob: {
    create: jest.fn().mockResolvedValue({ id: 999 }),
  },
};

jest.mock('../../utils/prismaClient', () => ({
  $transaction: jest.fn().mockImplementation(async (cb) => cb(mockTx)),
}));

const faker = require('faker');

// seed faker for deterministic test runs
faker.seed(12345);

// Mock dependent models
const mockFindEmploymentByUserId = jest.fn();
const mockCreateEmploymentDetails = jest.fn();
const mockUpdateEmploymentDetails = jest.fn();

const mockFindAddressByUserId = jest.fn();
const mockCreateAddress = jest.fn();
const mockUpdateAddress = jest.fn();

const mockCreateLoan = jest.fn();

const mockFindUserById = jest.fn();

jest.mock('../../models/employmentModel', () => ({
  findByUserId: (...args) => mockFindEmploymentByUserId(...args),
  createEmploymentDetails: (...args) => mockCreateEmploymentDetails(...args),
  updateEmploymentDetails: (...args) => mockUpdateEmploymentDetails(...args),
}));

jest.mock('../../models/adressModel', () => ({
  findByUserId: (...args) => mockFindAddressByUserId(...args),
  createAddress: (...args) => mockCreateAddress(...args),
  updateAddress: (...args) => mockUpdateAddress(...args),
}));

jest.mock('../../models/loanModel', () => ({
  createLoan: (...args) => mockCreateLoan(...args),
}));

jest.mock('../../models/userModel', () => ({
  findUserById: (...args) => mockFindUserById(...args),
}));

const { saveFullKYC } = require('../../services/kycService');
const { BadRequestError } = require('../../GlobalExceptionHandler/exception');

describe('KycService.saveFullKYC (unit)', () => {
  const userId = 123;
  const makePayload = (overrides = {}) => ({
    companyName: faker.company.companyName(),
    companyAddress: faker.address.streetAddress(),
    monthlyIncome: String(faker.datatype.number({ min: 10000, max: 200000 })),
    stability: faker.random.arrayElement(['VERY_STABLE', 'STABLE', 'NEUTRAL', 'SOMEWHAT_UNSTABLE']),
    employmentType: faker.random.arrayElement(['SALARIED', 'SELF_EMPLOYED', 'OTHER']),

    currentAddress: faker.address.streetAddress(),
    permanentAddress: faker.address.secondaryAddress(),
    currentAddressType: faker.random.arrayElement(['OWNER_SELF_OR_FAMILY', 'RENTED']),
    currentCity: faker.address.city(),
    currentState: faker.address.state(),
    currentPostalCode: faker.address.zipCode(),

    loanAmount: String(faker.datatype.number({ min: 10000, max: 500000 })),
    purpose: faker.random.arrayElement(['PERSONAL', 'HOME', 'BUSINESS', 'OTHER']),
    interestRate: String((faker.datatype.number({ min: 5, max: 15, precision: 0.1 })).toFixed(1)),
    termMonths: String(faker.random.arrayElement([12, 24, 36, 60])),
    ...overrides,
  });

  let baseValidPayload;

  beforeEach(() => {
    jest.clearAllMocks();
    baseValidPayload = makePayload();

    // Default mock setup to prevent TypeError on undefined model properties
    mockFindEmploymentByUserId.mockResolvedValue(null);
    mockCreateEmploymentDetails.mockResolvedValue({ id: 100 });
    mockUpdateEmploymentDetails.mockResolvedValue({ id: 100 });

    mockFindAddressByUserId.mockResolvedValue(null);
    mockCreateAddress.mockResolvedValue({ id: 200 });
    mockUpdateAddress.mockResolvedValue({ id: 200 });

    mockCreateLoan.mockResolvedValue({ id: 300 });
    mockFindUserById.mockResolvedValue({ id: userId, name: 'John Doe' });
  });

  it('throws when userId is not provided', async () => {
    await expect(saveFullKYC(null, {})).rejects.toThrow(BadRequestError);
    await expect(saveFullKYC(undefined, {})).rejects.toThrow('User ID is required');
  });

  it('validates employment payload presence', async () => {
    const payload = { ...baseValidPayload };
    delete payload.companyName;
    await expect(saveFullKYC(userId, payload)).rejects.toThrow('Employment data incomplete');
  });

  it('validates monthlyIncome numeric and non-negative', async () => {
    const payload = { ...baseValidPayload, monthlyIncome: 'not-a-number' };
    await expect(saveFullKYC(userId, payload)).rejects.toThrow('Invalid monthly income');

    const payload2 = { ...baseValidPayload, monthlyIncome: '-100' };
    await expect(saveFullKYC(userId, payload2)).rejects.toThrow('Invalid monthly income');
  });

  it('validates address payload presence', async () => {
    const payload = { ...baseValidPayload };
    delete payload.currentAddress;
    await expect(saveFullKYC(userId, payload)).rejects.toThrow('Address data incomplete');
  });

  it('validates loan payload presence and amount', async () => {
    const payload = { ...baseValidPayload };
    delete payload.loanAmount;
    await expect(saveFullKYC(userId, payload)).rejects.toThrow('Loan data incomplete');

    const payload2 = { ...baseValidPayload, loanAmount: '-5000' };
    await expect(saveFullKYC(userId, payload2)).rejects.toThrow('Invalid loan amount');
  });

  it('saves employment, address and loan and returns aggregated result for multiple payloads', async () => {
    // run the happy path for multiple randomized payloads generated by faker
    const iterations = 5;
    for (let i = 0; i < iterations; i++) {
      const payload = makePayload();

      // Arrange mocks to simulate DB operations per-iteration
      mockFindEmploymentByUserId.mockResolvedValueOnce(null);
      mockCreateEmploymentDetails.mockResolvedValueOnce({ id: 100 + i, employerName: payload.companyName });

      mockFindAddressByUserId.mockResolvedValueOnce(null);
      mockCreateAddress.mockResolvedValueOnce({ id: 200 + i, currentAddress: payload.currentAddress });

      mockCreateLoan.mockResolvedValueOnce({ id: 300 + i, loanAmount: Number(payload.loanAmount) });

      mockFindUserById.mockResolvedValueOnce({ id: userId, name: faker.name.findName() });

      // Act
      const result = await saveFullKYC(userId, payload);

      // Assert aggregated structure
      expect(result).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.user.id).toBe(userId);
      expect(result.employment).toBeDefined();
      expect(result.employment.id).toBe(100 + i);
      expect(result.addressDetail).toBeDefined();
      expect(result.addressDetail.id).toBe(200 + i);
      expect(result.loan).toBeDefined();
      expect(result.loan.id).toBe(300 + i);

      // Verify model functions received normalized values
      expect(mockCreateEmploymentDetails).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          employmentType: expect.any(String),
          employerName: payload.companyName,
          companyAddress: payload.companyAddress,
          monthlyIncome: Number(payload.monthlyIncome),
          stability: String(payload.stability).toUpperCase(),
        }),
        expect.any(Object)
      );

      expect(mockCreateAddress).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          currentAddress: payload.currentAddress,
          permanentAddress: payload.permanentAddress,
          currentAddressType: String(payload.currentAddressType).toUpperCase(),
        }),
        expect.any(Object)
      );

      expect(mockCreateLoan).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          loanAmount: Number(payload.loanAmount),
          purposeOfLoan: payload.purpose,
        }),
        expect.any(Object)
      );
    }
  });
});
