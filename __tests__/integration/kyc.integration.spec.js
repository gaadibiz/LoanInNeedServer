const request = require('supertest');
const app = require('../../server');
const DbHelper = require('../test-helpers/db.helper');
const AuthHelper = require('../test-helpers/auth.helper');
const TestFactories = require('../test-helpers/test-factories');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

describe('📋 KYC Integration Tests', () => {
  let authToken;
  let testUser;
  const testPhone = TestFactories.phone();

  beforeAll(async () => {
    // Create test user and get auth token
    const otpRes = await request(app)
      .post('/api/auth/phone/request-otp')
      .send({ phone: testPhone });

    const verifyRes = await request(app)
      .post('/api/auth/phone/verify-otp')
      .send({ phone: testPhone, code: '123456' });

    authToken = verifyRes.body.token;
    testUser = verifyRes.body.user;

    // Register user
    const userData = TestFactories.user({ phone: testPhone });
    await request(app)
      .post('/api/users/register')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: userData.name,
        dob: userData.dob.toISOString().split('T')[0],
        gender: userData.gender,
        email: userData.email,
        password: userData.password,
      });
  });

  afterAll(async () => {
    await DbHelper.deleteTestUser(testUser.id);
    await prisma.$disconnect();
  });

  describe('POST /api/kyc', () => {
    it('✅ should submit KYC data successfully', async () => {
      const kycData = TestFactories.kyc();

      const res = await request(app)
        .post('/api/kyc')
        .set('Authorization', `Bearer ${authToken}`)
        .send(kycData);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('saved successfully');
      expect(res.body.data).toBeDefined();
    });

    it('❌ should reject KYC with missing required fields', async () => {
      const incompleteKyc = {
        companyName: 'Test Company',
        // Missing other required fields
      };

      const res = await request(app)
        .post('/api/kyc')
        .set('Authorization', `Bearer ${authToken}`)
        .send(incompleteKyc);

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('❌ should reject KYC with invalid data types', async () => {
      const invalidKyc = TestFactories.kyc({
        monthlyIncome: 'not-a-number',
        loanAmount: 'invalid',
      });

      const res = await request(app)
        .post('/api/kyc')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidKyc);

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('❌ should require authentication', async () => {
      const kycData = TestFactories.kyc();

      const res = await request(app)
        .post('/api/kyc')
        .send(kycData);

      expect(res.status).toBe(401);
    });
  });
});

