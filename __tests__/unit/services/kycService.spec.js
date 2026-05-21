// Mock models and prisma first to ensure mock hoisting works correctly
const mockTx = {
  loanApplication: {
    create: jest.fn(),
  },
  losIntegrationJob: {
    create: jest.fn(),
  },
};

jest.mock('../../../models/employmentModel');
jest.mock('../../../models/adressModel');
jest.mock('../../../models/loanModel');
jest.mock('../../../models/userModel');
jest.mock('../../../utils/prismaClient', () => ({
  $transaction: jest.fn().mockImplementation(async (cb) => cb(mockTx)),
}));

const KYCService = require('../../../services/kycService');
const EmploymentModel = require('../../../models/employmentModel');
const AddressModel = require('../../../models/adressModel');
const LoanModel = require('../../../models/loanModel');
const UserModel = require('../../../models/userModel');
const { BadRequestError } = require('../../../GlobalExceptionHandler/exception');
const TestFactories = require('../../test-helpers/test-factories');

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
      const mockLoan = { id: 1, userId, loanAmount: 10000 };
      const mockUser = { id: userId, attributedPartnerId: null, attributionType: 'ORGANIC' };
      const mockApp = { id: 1, userId };
      const mockJob = { id: 1, applicationId: 1 };

      EmploymentModel.findByUserId.mockResolvedValue(null);
      EmploymentModel.createEmploymentDetails.mockResolvedValue(mockEmployment);
      
      AddressModel.findByUserId.mockResolvedValue(null);
      AddressModel.createAddress.mockResolvedValue(mockAddress);
      
      LoanModel.createLoan.mockResolvedValue(mockLoan);
      UserModel.findUserById.mockResolvedValue(mockUser);
      
      mockTx.loanApplication.create.mockResolvedValue(mockApp);
      mockTx.losIntegrationJob.create.mockResolvedValue(mockJob);

      const result = await KYCService.saveFullKYC(userId, kycData);

      expect(EmploymentModel.createEmploymentDetails).toHaveBeenCalled();
      expect(AddressModel.createAddress).toHaveBeenCalled();
      expect(LoanModel.createLoan).toHaveBeenCalled();
      expect(mockTx.loanApplication.create).toHaveBeenCalled();
      expect(mockTx.losIntegrationJob.create).toHaveBeenCalled();

      expect(result).toHaveProperty('employment');
      expect(result).toHaveProperty('addressDetail');
      expect(result).toHaveProperty('application');
    });

    it('❌ should handle missing required fields', async () => {
      const incompleteData = { companyName: 'Test' };

      EmploymentModel.findByUserId.mockResolvedValue(null);
      AddressModel.findByUserId.mockResolvedValue(null);

      await expect(KYCService.saveFullKYC(userId, incompleteData)).rejects.toThrow();
    });

    it('❌ should validate data types', async () => {
      const invalidData = {
        ...kycData,
        monthlyIncome: 'not-a-number',
      };

      EmploymentModel.findByUserId.mockResolvedValue(null);
      AddressModel.findByUserId.mockResolvedValue(null);

      await expect(KYCService.saveFullKYC(userId, invalidData)).rejects.toThrow();
    });
  });
});
