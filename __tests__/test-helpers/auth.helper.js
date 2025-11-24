const jwt = require('jsonwebtoken');
const TestFactories = require('./test-factories');

/**
 * Authentication Test Helper
 * Provides utilities for authentication in tests
 */
class AuthHelper {
  /**
   * Generate a test JWT token
   */
  static generateToken(payload = {}) {
    const defaultPayload = TestFactories.jwtPayload();
    const tokenPayload = { ...defaultPayload, ...payload };
    
    return jwt.sign(tokenPayload, process.env.JWT_SECRET || 'test-secret-key', {
      expiresIn: '24h',
    });
  }

  /**
   * Generate authorization header
   */
  static authHeader(token) {
    return {
      Authorization: `Bearer ${token}`,
    };
  }

  /**
   * Generate auth header with test user
   */
  static async authHeaderForUser(userId, phone) {
    const token = this.generateToken({ id: userId, phone });
    return this.authHeader(token);
  }

  /**
   * Decode token without verification (for testing)
   */
  static decodeToken(token) {
    return jwt.decode(token);
  }
}

module.exports = AuthHelper;

