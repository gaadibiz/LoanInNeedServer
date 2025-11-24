const request = require('supertest');
const app = require('../../server');
const DbHelper = require('../test-helpers/db.helper');
const TestFactories = require('../test-helpers/test-factories');
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');

const prisma = new PrismaClient();

describe('📄 Document Upload Integration Tests', () => {
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

  describe('POST /api/document/submit', () => {
    it('✅ should upload documents successfully', async () => {
      // Create mock files
      const salarySlip = Buffer.from('mock salary slip content');
      const bankStatement = Buffer.from('mock bank statement content');

      const res = await request(app)
        .post('/api/document/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .field('panNumber', TestFactories.pan().panNumber)
        .field('aadhaarNumber', TestFactories.aadhaar().aadhaarNumber)
        .field('latitude', '28.6139')
        .field('longitude', '77.2090')
        .field('consent', 'true')
        .attach('salarySlips', salarySlip, 'salary-slip.pdf')
        .attach('bankStatements', bankStatement, 'bank-statement.pdf');

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('uploaded successfully');
      expect(res.body.uploadedDocs).toBeDefined();
      expect(Array.isArray(res.body.uploadedDocs)).toBe(true);
    });

    it('❌ should reject upload without required documents', async () => {
      const res = await request(app)
        .post('/api/document/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .field('panNumber', TestFactories.pan().panNumber)
        .field('aadhaarNumber', TestFactories.aadhaar().aadhaarNumber)
        // Missing files
        .send();

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('❌ should require authentication', async () => {
      const res = await request(app)
        .post('/api/document/submit')
        .send();

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/document/status', () => {
    it('✅ should get document status', async () => {
      const res = await request(app)
        .get('/api/document/status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('docs');
      expect(res.body).toHaveProperty('isSelfieUploaded');
      expect(res.body).toHaveProperty('status');
    });

    it('❌ should require authentication', async () => {
      const res = await request(app)
        .get('/api/document/status')
        .send();

      expect(res.status).toBe(401);
    });
  });
});

