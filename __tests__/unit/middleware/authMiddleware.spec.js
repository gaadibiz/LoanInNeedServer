const { authenticate } = require('../../../middleware/authMiddleware');
const jwt = require('jsonwebtoken');
const prisma = require('../../../utils/prismaClient');
const { UnauthorizedError } = require('../../../GlobalExceptionHandler/exception');
const { mockRequest, mockResponse, mockNext } = require('../../test-helpers/mock-factories');

jest.mock('jsonwebtoken');
jest.mock('../../../utils/prismaClient', () => ({
  user: {
    findUnique: jest.fn(),
  },
}));

describe('🔐 AuthMiddleware Unit Tests', () => {
  let req, res, next;

  beforeEach(() => {
    req = mockRequest();
    res = mockResponse();
    next = mockNext();
    jest.clearAllMocks();
  });

  it('✅ should authenticate valid token', async () => {
    const token = 'valid-token';
    req.headers.authorization = `Bearer ${token}`;
    jwt.verify.mockReturnValue({ id: 1 });
    prisma.user.findUnique.mockResolvedValue({
      id: 1,
      customUserId: 'U1',
      email: 'test@example.com',
      phone: '+911234567890',
      role: 'CUSTOMER',
    });

    await authenticate(req, res, next);

    expect(jwt.verify).toHaveBeenCalledWith(token, process.env.JWT_SECRET);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(req.user).toEqual({
      id: 1,
      customUserId: 'U1',
      email: 'test@example.com',
      phone: '+911234567890',
      role: 'CUSTOMER',
    });
    expect(next).toHaveBeenCalledWith();
  });

  it('❌ should reject request without token', async () => {
    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('❌ should reject request with invalid token format', async () => {
    req.headers.authorization = 'InvalidFormat token';

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('❌ should reject request with invalid token', async () => {
    req.headers.authorization = 'Bearer invalid-token';
    jwt.verify.mockImplementation(() => {
      throw new Error('jwt expired');
    });

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('❌ should reject request if user not found in DB', async () => {
    req.headers.authorization = 'Bearer valid-token';
    jwt.verify.mockReturnValue({ id: 999 });
    prisma.user.findUnique.mockResolvedValue(null);

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });
});
