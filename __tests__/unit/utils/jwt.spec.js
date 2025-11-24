const jwt = require('jsonwebtoken');
const { generateToken, verifyToken } = require('../../../utils/jwt');
const TestFactories = require('../../test-helpers/test-factories');

describe('🎫 JWT Utility Tests', () => {
  const secret = process.env.JWT_SECRET || 'test-secret';

  describe('generateToken', () => {
    it('✅ should generate a valid JWT token', () => {
      const payload = TestFactories.jwtPayload();
      const token = generateToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      
      // Verify token can be decoded
      const decoded = jwt.decode(token);
      expect(decoded.id).toBe(payload.id);
    });

    it('✅ should include expiration in token', () => {
      const payload = TestFactories.jwtPayload();
      const token = generateToken(payload);
      const decoded = jwt.decode(token);

      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
    });
  });

  describe('verifyToken', () => {
    it('✅ should verify a valid token', () => {
      const payload = TestFactories.jwtPayload();
      const token = generateToken(payload);

      const verified = verifyToken(token);
      expect(verified.id).toBe(payload.id);
    });

    it('❌ should reject invalid token', () => {
      const invalidToken = 'invalid.token.here';

      expect(() => verifyToken(invalidToken)).toThrow();
    });

    it('❌ should reject expired token', () => {
      const payload = TestFactories.jwtPayload();
      const expiredToken = jwt.sign(payload, secret, { expiresIn: '-1h' });

      expect(() => verifyToken(expiredToken)).toThrow();
    });
  });
});

