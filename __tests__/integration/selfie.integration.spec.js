const request = require('supertest');
const app = require('../../server');
const DbHelper = require('../test-helpers/db.helper');
const TestFactories = require('../test-helpers/test-factories');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

describe('📸 Selfie Upload Integration Tests', () => {
  let authToken;
  let testUser;
  const testPhone = TestFactories.phone();

  beforeAll(async () => {
    // Create test user and get auth token
    await request(app)
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

  describe('POST /api/selfie/upload', () => {
    it('✅ should upload selfie successfully', async () => {
      // Create mock image file
      const selfieImage = Buffer.from('mock selfie image content');

      const res = await request(app)
        .post('/api/selfie/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('selfie', selfieImage, 'selfie.jpg');

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('uploaded successfully');
      expect(res.body.selfie).toBeDefined();
      expect(res.body.selfie.docType).toBe('PHOTO');
    });

    it('❌ should reject upload without file', async () => {
      const res = await request(app)
        .post('/api/selfie/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .send();

      expect(res.status).toBe(400);
    });

    it('❌ should require authentication', async () => {
      const selfieImage = Buffer.from('mock selfie image content');

      const res = await request(app)
        .post('/api/selfie/upload')
        .attach('selfie', selfieImage, 'selfie.jpg');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/selfie/status', () => {
    it('✅ should get selfie status', async () => {
      const res = await request(app)
        .get('/api/selfie/status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('uploaded');
      expect(res.body).toHaveProperty('status');
    });

    it('❌ should require authentication', async () => {
      const res = await request(app)
        .get('/api/selfie/status')
        .send();

      expect(res.status).toBe(401);
    });
  });
});

