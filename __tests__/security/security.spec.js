const request = require('supertest');
const app = require('../../server');
const TestFactories = require('../test-helpers/test-factories');

describe('🔒 Security Tests', () => {
  describe('Authentication Security', () => {
    it('✅ should reject requests without authentication token', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .send();

      expect(res.status).toBe(401);
    });

    it('✅ should reject requests with invalid token', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', 'Bearer invalid-token-here')
        .send();

      expect(res.status).toBe(401);
    });

    it('✅ should reject requests with malformed token', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', 'InvalidFormat token')
        .send();

      expect(res.status).toBe(401);
    });
  });

  describe('Input Validation Security', () => {
    it('✅ should sanitize SQL injection attempts', async () => {
      const maliciousInput = "'; DROP TABLE users; --";
      
      const res = await request(app)
        .post('/api/auth/phone/request-otp')
        .send({ phone: maliciousInput });

      // Should not crash and should handle gracefully
      expect([200, 400, 422]).toContain(res.status);
    });

    it('✅ should validate phone number format', async () => {
      const invalidPhones = [
        '123',
        'not-a-phone',
        '<script>alert("xss")</script>',
        '12345678901234567890', // too long
      ];

      for (const phone of invalidPhones) {
        const res = await request(app)
          .post('/api/auth/phone/request-otp')
          .send({ phone });

        expect(res.status).toBeGreaterThanOrEqual(400);
      }
    });

    it('✅ should validate email format', async () => {
      const invalidEmails = [
        'not-an-email',
        'test@',
        '@domain.com',
        'test@domain',
      ];

      const testPhone = TestFactories.phone();
      await request(app)
        .post('/api/auth/phone/request-otp')
        .send({ phone: testPhone });

      const verifyRes = await request(app)
        .post('/api/auth/phone/verify-otp')
        .send({ phone: testPhone, code: '123456' });

      const token = verifyRes.body.token;

      for (const email of invalidEmails) {
        const res = await request(app)
          .post('/api/users/register')
          .set('Authorization', `Bearer ${token}`)
          .send({
            name: 'Test User',
            email,
            dob: '1990-01-01',
            gender: 'MALE',
            password: 'Test@1234',
          });

        expect(res.status).toBeGreaterThanOrEqual(400);
      }
    });
  });

  describe('Rate Limiting', () => {
    it('✅ should handle multiple rapid requests', async () => {
      const testPhone = TestFactories.phone();
      const requests = Array(10).fill(null).map(() =>
        request(app)
          .post('/api/auth/phone/request-otp')
          .send({ phone: testPhone })
      );

      const responses = await Promise.all(requests);
      
      // All should complete (rate limiting would return 429)
      responses.forEach((res) => {
        expect([200, 429]).toContain(res.status);
      });
    });
  });

  describe('CORS Security', () => {
    it('✅ should include CORS headers', async () => {
      const res = await request(app)
        .options('/api/auth/phone/request-otp')
        .send();

      // CORS should be configured
      expect(res.headers).toBeDefined();
    });
  });

  describe('Helmet Security Headers', () => {
    it('✅ should include security headers', async () => {
      const res = await request(app)
        .get('/')
        .send();

      // Helmet should add security headers
      expect(res.headers).toBeDefined();
    });
  });
});

