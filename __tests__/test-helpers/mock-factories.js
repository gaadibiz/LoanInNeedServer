/**
 * Mock Factories
 * Create mocks for external services
 */

/**
 * Mock Supabase Storage
 */
function mockSupabaseStorage() {
  return {
    from: jest.fn(() => ({
      upload: jest.fn(() => Promise.resolve({ error: null })),
      getPublicUrl: jest.fn(() => ({
        data: {
          publicUrl: 'https://supabase.co/storage/v1/object/public/test-bucket/test-file.jpg',
        },
      })),
      remove: jest.fn(() => Promise.resolve({ error: null })),
    })),
  };
}

/**
 * Mock Supabase Client
 */
function mockSupabaseClient() {
  return {
    storage: mockSupabaseStorage(),
  };
}

/**
 * Mock Twilio Client
 */
function mockTwilioClient() {
  return {
    messages: {
      create: jest.fn(() =>
        Promise.resolve({
          sid: 'SM' + Math.random().toString(36).substr(2, 34),
          status: 'sent',
        })
      ),
    },
    verify: {
      services: jest.fn(() => ({
        verifications: {
          create: jest.fn(() =>
            Promise.resolve({
              sid: 'VE' + Math.random().toString(36).substr(2, 34),
              status: 'pending',
            })
          ),
        },
        verificationChecks: {
          create: jest.fn(() =>
            Promise.resolve({
              status: 'approved',
              valid: true,
            })
          ),
        },
      })),
    },
  };
}

/**
 * Mock Multer File
 */
function mockMulterFile(overrides = {}) {
  return {
    fieldname: 'file',
    originalname: 'test.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: 1024,
    destination: '/tmp',
    filename: 'test-123.jpg',
    path: '/tmp/test-123.jpg',
    buffer: Buffer.from('test file content'),
    ...overrides,
  };
}

/**
 * Mock Express Request
 */
function mockRequest(overrides = {}) {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    user: null,
    files: {},
    file: null,
    ...overrides,
  };
}

/**
 * Mock Express Response
 */
function mockResponse() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  res.redirect = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  res.getHeader = jest.fn();
  return res;
}

/**
 * Mock Express Next
 */
function mockNext() {
  return jest.fn();
}

module.exports = {
  mockSupabaseClient,
  mockSupabaseStorage,
  mockTwilioClient,
  mockMulterFile,
  mockRequest,
  mockResponse,
  mockNext,
};

