const { phoneOtpRateLimiter } = require('../../../middleware/phoneOtpRateLimiter');
const prisma = require('../../../utils/prismaClient');

jest.mock('../../../utils/prismaClient', () => ({
  otp: {
    findFirst: jest.fn(),
    count: jest.fn(),
  },
}));

describe('⏱️ phoneOtpRateLimiter Middleware Unit Tests', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      headers: {
        'x-enforce-phone-limiter': 'true',
      },
      body: {
        phone: '+919876543210',
      },
      ip: '127.0.0.1',
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    next = jest.fn();
  });

  it('✅ should pass when no recent OTP exists and within hourly limit', async () => {
    prisma.otp.findFirst.mockResolvedValue(null);
    prisma.otp.count.mockResolvedValue(0);

    await phoneOtpRateLimiter(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('❌ should block with 429 when cooldown is active (recent OTP created 15 seconds ago)', async () => {
    const fifteenSecondsAgo = new Date(Date.now() - 15 * 1000);
    prisma.otp.findFirst.mockResolvedValue({ createdAt: fifteenSecondsAgo });

    await phoneOtpRateLimiter(req, res, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: expect.stringContaining('Please wait'),
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it('❌ should block with 429 when hourly quota is exceeded', async () => {
    prisma.otp.findFirst.mockResolvedValue(null); // not in cooldown
    prisma.otp.count.mockResolvedValue(5); // reached max 5/hr

    await phoneOtpRateLimiter(req, res, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: expect.stringContaining('Too many OTP requests for this phone number'),
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it('✅ should skip rate limiting if phone number is not in body', async () => {
    req.body = {};

    await phoneOtpRateLimiter(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(prisma.otp.findFirst).not.toHaveBeenCalled();
  });
});
