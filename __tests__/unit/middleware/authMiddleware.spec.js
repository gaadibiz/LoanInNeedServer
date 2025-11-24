const { authenticate } = require('../../../middleware/authMiddleware');
const { verifyToken } = require('../../../utils/jwt');
const { UnauthorizedError } = require('../../../GlobalExceptionHandler/exception');
const { mockRequest, mockResponse, mockNext } = require('../../test-helpers/mock-factories');

jest.mock('../../../utils/jwt');

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
    verifyToken.mockReturnValue({ id: 1, phone: '+911234567890' });

    await authenticate(req, res, next);

    expect(verifyToken).toHaveBeenCalledWith(token);
    expect(req.user).toBeDefined();
    expect(req.user.id).toBe(1);
    expect(next).toHaveBeenCalled();
  });

  it('❌ should reject request without token', async () => {
    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('❌ should reject request with invalid token format', async () => {
    req.headers.authorization = 'InvalidFormat token';

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('❌ should reject request with invalid token', async () => {
    req.headers.authorization = 'Bearer invalid-token';
    verifyToken.mockImplementation(() => {
      throw new Error('Invalid token');
    });

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

