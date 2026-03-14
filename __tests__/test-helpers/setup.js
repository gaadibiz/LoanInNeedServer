const { PrismaClient } = require('@prisma/client');
const DbHelper = require('./db.helper');
const mockTwilio = require('./mockTwilio');
const logger = require('../../utils/logger');

// Suppress logger output during tests (optional - comment out for debugging)
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

// Mock Twilio globally
jest.mock('../../utils/twilioOtp', () => mockTwilio);

// Mock Supabase
jest.mock('../../config/supabase', () => ({
  supabase: {
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn(() => Promise.resolve({ error: null })),
        getPublicUrl: jest.fn(() => ({
          data: {
            publicUrl: 'https://supabase.co/storage/test-file.jpg',
          },
        })),
      })),
    },
  },
}));

// Global test setup
beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key';
  process.env.SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'test-bucket';

  // Connect to database
  await DbHelper.cleanupTestData();
  logger.info('🟢 Test environment initialized');
});

// Clean up after each test suite
afterAll(async () => {
  await DbHelper.cleanupTestData();
  await DbHelper.disconnect();
  logger.info('🔴 Test environment cleaned up');
});

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});
