const KYCService = require('../../../services/kycService');
const EmploymentModel = require('../../../models/employmentModel');
const AddressModel = require('../../../models/adressModel');
const LoanApplicationModel = require('../../../models/loanApplicationModel');
const { BadRequestError } = require('../../../GlobalExceptionHandler/exception');
const TestFactories = require('../../test-helpers/test-factories');

// Mock dependencies
jest.mock('../../../models/employmentModel');
jest.mock('../../../models/adressModel');
jest.mock('../../../models/loanApplicationModel');

describe('📋 KYCService Unit Tests', () => {
  const userId = 1;
  let kycData;

  beforeEach(() => {
    jest.clearAllMocks();
    kycData = TestFactories.kyc();
  });

  describe('saveFullKYC', () => {
    it('✅ should save full KYC data successfully', async () => {
      const mockEmployment = { id: 1, userId };
      const mockAddress = { id: 1, userId };
      const mockLoanApp = { id: 1, userId };

      EmploymentModel.createEmploymentDetails.mockResolvedValue(mockEmployment);
      AddressModel.createAddress.mockResolvedValue(mockAddress);
      LoanApplicationModel.createLoanApplication.mockResolvedValue(mockLoanApp);

      const result = await KYCService.saveFullKYC(userId, kycData);

      expect(EmploymentModel.createEmploymentDetails).toHaveBeenCalled();
      expect(AddressModel.createAddress).toHaveBeenCalled();
      expect(LoanApplicationModel.createLoanApplication).toHaveBeenCalled();
      expect(result).toHaveProperty('employment');
      expect(result).toHaveProperty('address');
      expect(result).toHaveProperty('loanApplication');
    });

    it('❌ should handle missing required fields', async () => {
      const incompleteData = { companyName: 'Test' };

      await expect(KYCService.saveFullKYC(userId, incompleteData)).rejects.toThrow();
    });

    it('❌ should validate data types', async () => {
      const invalidData = {
        ...kycData,
        monthlyIncome: 'not-a-number',
      };

      await expect(KYCService.saveFullKYC(userId, invalidData)).rejects.toThrow();
    });
  });
});

