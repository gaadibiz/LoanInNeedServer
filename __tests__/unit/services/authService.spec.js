const AuthService = require('../../../services/authService');
const smsOtpService = require('../../../utils/smsOtpService');
const prisma = require('../../../utils/prismaClient');
const { generateToken } = require('../../../utils/jwt');
const { BadRequestError } = require('../../../GlobalExceptionHandler/exception');
const TestFactories = require('../../test-helpers/test-factories');

// Mock dependencies
jest.mock('../../../utils/smsOtpService');
jest.mock('../../../utils/jwt');
jest.mock('../../../utils/prismaClient', () => ({
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  panVerification: {
    findUnique: jest.fn(),
  },
  aadhaarVerification: {
    findUnique: jest.fn(),
  },
}));

describe('🔐 AuthService Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('requestPhoneOtp', () => {
    it('✅ should request OTP successfully', async () => {
      const phone = TestFactories.phone();
      prisma.user.findUnique.mockResolvedValue(null);
      smsOtpService.sendOtp.mockResolvedValue({ status: 'pending' });

      const result = await AuthService.requestPhoneOtp(phone);

      expect(smsOtpService.sendOtp).toHaveBeenCalledWith(phone);
      expect(result).toHaveProperty('message');
    });

    it('❌ should handle OTP service errors', async () => {
      const phone = TestFactories.phone();
      prisma.user.findUnique.mockResolvedValue(null);
      smsOtpService.sendOtp.mockRejectedValue(new Error('OTP service failed'));

      await expect(AuthService.requestPhoneOtp(phone)).rejects.toThrow();
    });
  });

  describe('verifyPhoneOtp', () => {
    it('✅ should verify OTP and return token', async () => {
      const phone = TestFactories.phone();
      const code = '123456';
      const mockUser = TestFactories.user({ phone, customUserId: 'LIN001' });

      smsOtpService.verifyOtp.mockResolvedValue({ status: 'approved' });
      prisma.user.findUnique.mockResolvedValue(mockUser);
      generateToken.mockReturnValue('mock-jwt-token');
      prisma.panVerification.findUnique.mockResolvedValue({ id: 1 });
      prisma.aadhaarVerification.findUnique.mockResolvedValue({ id: 1 });

      const result = await AuthService.verifyPhoneOtp(phone, code);

      expect(smsOtpService.verifyOtp).toHaveBeenCalledWith(phone, code);
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('user');
      expect(result.token).toBe('mock-jwt-token');
    });

    it('❌ should reject invalid OTP', async () => {
      const phone = TestFactories.phone();
      const code = '000000';

      smsOtpService.verifyOtp.mockResolvedValue({ status: 'failed' });

      await expect(AuthService.verifyPhoneOtp(phone, code)).rejects.toThrow(BadRequestError);
    });
  });
});
