const request = require('supertest');
const app = require('../../server');
const DbHelper = require('../test-helpers/db.helper');
const TestFactories = require('../test-helpers/test-factories');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

describe('📍 Location Integration Tests', () => {
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

  describe('POST /api/users/location', () => {
    it('✅ should save location successfully', async () => {
      const locationData = TestFactories.location();

      const res = await request(app)
        .post('/api/users/location')
        .set('Authorization', `Bearer ${authToken}`)
        .send(locationData);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('saved successfully');
      expect(res.body.location).toBeDefined();
      expect(res.body.location.latitude).toBe(locationData.latitude);
      expect(res.body.location.longitude).toBe(locationData.longitude);
    });

    it('❌ should reject location without latitude', async () => {
      const locationData = TestFactories.location();
      delete locationData.latitude;

      const res = await request(app)
        .post('/api/users/location')
        .set('Authorization', `Bearer ${authToken}`)
        .send(locationData);

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('❌ should reject location without longitude', async () => {
      const locationData = TestFactories.location();
      delete locationData.longitude;

      const res = await request(app)
        .post('/api/users/location')
        .set('Authorization', `Bearer ${authToken}`)
        .send(locationData);

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('❌ should require authentication', async () => {
      const locationData = TestFactories.location();

      const res = await request(app)
        .post('/api/users/location')
        .send(locationData);

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/users/location', () => {
    it('✅ should get latest location', async () => {
      // First save a location
      const locationData = TestFactories.location();
      await request(app)
        .post('/api/users/location')
        .set('Authorization', `Bearer ${authToken}`)
        .send(locationData);

      // Then get it
      const res = await request(app)
        .get('/api/users/location')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.location).toBeDefined();
      expect(res.body.location).toHaveProperty('latitude');
      expect(res.body.location).toHaveProperty('longitude');
    });

    it('❌ should return 404 if no location found', async () => {
      // Use a different user token
      const newPhone = TestFactories.phone();
      await request(app)
        .post('/api/auth/phone/request-otp')
        .send({ phone: newPhone });

      const verifyRes = await request(app)
        .post('/api/auth/phone/verify-otp')
        .send({ phone: newPhone, code: '123456' });

      const newToken = verifyRes.body.token;

      const res = await request(app)
        .get('/api/users/location')
        .set('Authorization', `Bearer ${newToken}`);

      expect(res.status).toBe(404);
    });

    it('❌ should require authentication', async () => {
      const res = await request(app)
        .get('/api/users/location')
        .send();

      expect(res.status).toBe(401);
    });
  });
});

