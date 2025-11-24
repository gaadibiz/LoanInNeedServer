const request = require('supertest');
const app = require('../../server');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const logger = require('../../utils/logger');

// Mock Twilio so real SMS are not sent
require('../../test-helpers/mockTwilio');

describe('📱 Phone OTP Authentication', () => {
  const testPhone = '+919876543210'; // test phone
  const testOtp = '123456';           // mock OTP

  afterAll(async () => {
    logger.info('🧹 Cleaning up test user...');
    await prisma.user.deleteMany({ where: { phone: testPhone } });
    await prisma.$disconnect();
  });

  it('✅ should request OTP successfully', async () => {
    const res = await request(app)
      .post('/api/auth/phone/request-otp')
      .send({ phone: testPhone });

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('OTP sent successfully.');
    logger.info('OTP request test passed for %s', testPhone);
  });

  it('✅ should verify OTP and create a user', async () => {
    const res = await request(app)
      .post('/api/auth/phone/verify-otp')
      .send({ phone: testPhone, code: testOtp });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.phone).toBe(testPhone);
    logger.info('OTP verification test passed, token received: %s', res.body.token.slice(0, 25) + '...');
  });

  it('✅ should fail verification with wrong OTP', async () => {
    const res = await request(app)
      .post('/api/auth/phone/verify-otp')
      .send({ phone: testPhone, code: '000000' });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('Invalid OTP');
    logger.info('OTP rejection test passed for invalid code');
  });
});
