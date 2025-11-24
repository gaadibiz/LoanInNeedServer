const request = require('supertest');
const app = require('../../server');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const faker = require('faker');
const logger = require('../../utils/logger');

// Ensure Twilio is mocked so no real SMS are sent
require('../test-helpers/mockTwilio');

faker.seed(20251026);

describe('👤 User registration and profile (integration)', () => {
  const testPhone = `+91${faker.phone.phoneNumber('##########')}`;
  let token;

  afterAll(async () => {
    logger.info('🧹 Cleaning up test user for phone %s', testPhone);
    await prisma.user.deleteMany({ where: { phone: testPhone } });
    await prisma.$disconnect();
  });

  it('requests OTP and verifies (creates a placeholder user)', async () => {
    const res1 = await request(app)
      .post('/api/auth/phone/request-otp')
      .send({ phone: testPhone });

    expect(res1.statusCode).toBe(200);
    expect(res1.body.message).toMatch(/OTP sent/i);

    const res2 = await request(app)
      .post('/api/auth/phone/verify-otp')
      .send({ phone: testPhone, code: '123456' });

    expect(res2.statusCode).toBe(200);
    expect(res2.body).toHaveProperty('token');
    expect(res2.body.user).toBeDefined();
    expect(res2.body.user.phone).toBe(testPhone);

    token = res2.body.token;
  });

  it('registers the user (step after OTP) and returns profile summary', async () => {
    const firstName = faker.name.firstName();
    const middleName = faker.name.firstName();
    const lastName = faker.name.lastName();
    const fullName = `${firstName} ${middleName} ${lastName}`;

    const payload = {
      name: fullName,
      dob: faker.date.past(30, new Date('2002-01-01')).toISOString().split('T')[0],
      gender: faker.random.arrayElement(['MALE', 'FEMALE', 'PREFER_NOT_TO_SAY']),
      email: faker.internet.email(firstName, lastName),
      password: 'Test@1234'
    };

    const res = await request(app)
      .post('/api/user/register')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('message');
    expect(res.body.user).toBeDefined();
    expect(res.body.user.phone).toBe(testPhone);
    expect(res.body.user.name).toBe(fullName);
  });

  it('fetches /api/user/me with the token and returns full user record', async () => {
    const res = await request(app)
      .get('/api/user/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('message');
    expect(res.body.user).toBeDefined();
    expect(res.body.user.phone).toBe(testPhone);
    expect(res.body.user.name).toBeTruthy();
    expect(res.body.user.email).toMatch(/@/);
  });
});
