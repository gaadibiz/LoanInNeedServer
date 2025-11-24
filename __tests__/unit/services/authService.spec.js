const AuthService = require('../../../services/authService');
const OtpService = require('../../../services/otpService');
const UserModel = require('../../../models/userModel');
const { BadRequestError, UnauthorizedError } = require('../../../GlobalExceptionHandler/exception');
const TestFactories = require('../../test-helpers/test-factories');

// Mock dependencies
jest.mock('../../../services/otpService');
jest.mock('../../../models/userModel');
jest.mock('../../../utils/jwt');

describe('🔐 AuthService Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('requestPhoneOtp', () => {
    it('✅ should request OTP successfully', async () => {
      const phone = TestFactories.phone();
      OtpService.sendOtp.mockResolvedValue({ success: true });

      const result = await AuthService.requestPhoneOtp(phone);

      expect(OtpService.sendOtp).toHaveBeenCalledWith(phone);
      expect(result).toHaveProperty('message');
    });

    it('❌ should handle OTP service errors', async () => {
      const phone = TestFactories.phone();
      OtpService.sendOtp.mockRejectedValue(new Error('OTP service failed'));

      await expect(AuthService.requestPhoneOtp(phone)).rejects.toThrow();
    });
  });

  describe('verifyPhoneOtp', () => {
    it('✅ should verify OTP and return token', async () => {
      const phone = TestFactories.phone();
      const code = '123456';
      const mockUser = TestFactories.user({ phone });
      
      OtpService.verifyOtp.mockResolvedValue({ verified: true });
      UserModel.findUserByPhone.mockResolvedValue(mockUser);
      UserModel.createUser.mockResolvedValue(mockUser);

      const result = await AuthService.verifyPhoneOtp(phone, code);

      expect(OtpService.verifyOtp).toHaveBeenCalledWith(phone, code);
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('user');
    });

    it('❌ should reject invalid OTP', async () => {
      const phone = TestFactories.phone();
      const code = '000000';
      
      OtpService.verifyOtp.mockResolvedValue({ verified: false });

      await expect(AuthService.verifyPhoneOtp(phone, code)).rejects.toThrow(UnauthorizedError);
    });
  });
});

