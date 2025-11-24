const request = require('supertest');
const app = require('../../server');
const TestFactories = require('../test-helpers/test-factories');

describe('⚡ Performance Tests', () => {
  describe('Response Time Tests', () => {
    it('✅ health check should respond quickly', async () => {
      const start = Date.now();
      const res = await request(app).get('/');
      const duration = Date.now() - start;

      expect(res.status).toBe(200);
      expect(duration).toBeLessThan(1000); // Should respond in < 1 second
    });

    it('✅ OTP request should respond within acceptable time', async () => {
      const testPhone = TestFactories.phone();
      const start = Date.now();
      const res = await request(app)
        .post('/api/auth/phone/request-otp')
        .send({ phone: testPhone });
      const duration = Date.now() - start;

      expect(res.status).toBe(200);
      expect(duration).toBeLessThan(2000); // Should respond in < 2 seconds
    });
  });

  describe('Concurrent Request Handling', () => {
    it('✅ should handle concurrent OTP requests', async () => {
      const phones = Array(5).fill(null).map(() => TestFactories.phone());
      const requests = phones.map((phone) =>
        request(app)
          .post('/api/auth/phone/request-otp')
          .send({ phone })
      );

      const start = Date.now();
      const responses = await Promise.all(requests);
      const duration = Date.now() - start;

      responses.forEach((res) => {
        expect(res.status).toBe(200);
      });

      // All requests should complete in reasonable time
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('Database Query Performance', () => {
    it('✅ user profile fetch should be fast', async () => {
      // Setup: Create user and get token
      const testPhone = TestFactories.phone();
      await request(app)
        .post('/api/auth/phone/request-otp')
        .send({ phone: testPhone });

      const verifyRes = await request(app)
        .post('/api/auth/phone/verify-otp')
        .send({ phone: testPhone, code: '123456' });

      const token = verifyRes.body.token;

      // Test: Fetch profile
      const start = Date.now();
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`);
      const duration = Date.now() - start;

      expect(res.status).toBe(200);
      expect(duration).toBeLessThan(1000); // Should be fast
    });
  });
});

