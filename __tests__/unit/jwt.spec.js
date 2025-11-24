const { generateToken, verifyToken } = require('../../utils/jwt');
const dotenv = require('dotenv');
dotenv.config(); // ensure JWT_SECRET is loaded

describe('🛡️ JWT Utility', () => {
  const payload = { id: 'LIN001', role: 'CUSTOMER', email: 'test@example.com', phone: '+919876543210' };
  let token;

  it('✅ should generate a valid JWT token', () => {
    token = generateToken(payload);
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3); // JWT has 3 parts
  });

  it('✅ should verify a valid JWT token', () => {
    const decoded = verifyToken(token);
    expect(decoded.id).toBe(payload.id);
    expect(decoded.role).toBe(payload.role);
    expect(decoded.email).toBe(payload.email);
    expect(decoded.phone).toBe(payload.phone);
  });

  it('❌ should fail verification for invalid token', () => {
    expect(() => verifyToken('invalid.token.value')).toThrow();
  });

  it('❌ should fail verification for expired token', async () => {
    // Generate token with very short expiry for test
    const shortToken = generateToken(payload, '1ms'); // pass second param if you modify generateToken to accept expiresIn
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(() => verifyToken(shortToken)).toThrow(/jwt expired/);
  });
});
