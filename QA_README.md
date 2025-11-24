# 🧪 LoanInNeed Backend - Quality Assurance Documentation

## Overview

This document describes the comprehensive QA setup for the LoanInNeed Backend API. The test suite follows industry best practices and ensures code quality, reliability, and maintainability.

## 📁 Test Structure

```
__tests__/
├── integration/          # Integration tests (API endpoints)
│   ├── auth.phone.spec.js
│   ├── user.basic.spec.js
│   ├── kyc.integration.spec.js
│   ├── document.integration.spec.js
│   ├── selfie.integration.spec.js
│   └── location.integration.spec.js
├── unit/                 # Unit tests (services, utilities)
│   ├── hash.spec.js
│   ├── jwt.spec.js
│   ├── kycService.spec.js
│   └── services/
├── security/             # Security tests
│   └── security.spec.js
├── performance/          # Performance tests
│   └── performance.spec.js
└── test-helpers/         # Test utilities and helpers
    ├── setup.js
    ├── teardown.js
    ├── db.helper.js
    ├── auth.helper.js
    ├── test-factories.js
    ├── mock-factories.js
    └── mockTwilio.js
```

## 🚀 Running Tests

### All Tests
```bash
npm test
```

### Watch Mode
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

### Unit Tests Only
```bash
npm run test:unit
```

### Integration Tests Only
```bash
npm run test:integration
```

### CI Mode
```bash
npm run test:ci
```

### Debug Mode
```bash
npm run test:debug
```

## 📊 Coverage Requirements

### Global Thresholds
- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

### Critical Paths
- **Controllers**: 80% coverage
- **Services**: 75% coverage

## 🛠️ Test Utilities

### TestFactories
Generate consistent test data:
```javascript
const TestFactories = require('./test-helpers/test-factories');

const user = TestFactories.user();
const kyc = TestFactories.kyc();
const location = TestFactories.location();
```

### AuthHelper
Authentication utilities:
```javascript
const AuthHelper = require('./test-helpers/auth.helper');

const token = AuthHelper.generateToken({ id: 1, phone: '+911234567890' });
const headers = AuthHelper.authHeader(token);
```

### DbHelper
Database utilities:
```javascript
const DbHelper = require('./test-helpers/db.helper');

await DbHelper.cleanupTestData();
await DbHelper.createTestUser(userData);
await DbHelper.deleteTestUser(userId);
```

### Mock Factories
Create mocks for external services:
```javascript
const { mockSupabaseClient, mockTwilioClient } = require('./test-helpers/mock-factories');
```

## 📝 Writing Tests

### Integration Test Example
```javascript
const request = require('supertest');
const app = require('../../server');
const TestFactories = require('../test-helpers/test-factories');

describe('Feature Integration Tests', () => {
  let authToken;

  beforeAll(async () => {
    // Setup test data
  });

  afterAll(async () => {
    // Cleanup
  });

  it('✅ should perform action successfully', async () => {
    const res = await request(app)
      .post('/api/endpoint')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ data: 'test' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success');
  });
});
```

### Unit Test Example
```javascript
const Service = require('../../../services/service');
const { mockRequest, mockResponse } = require('../../test-helpers/mock-factories');

describe('Service Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('✅ should process data correctly', async () => {
    const result = await Service.processData({ input: 'test' });
    expect(result).toBeDefined();
  });
});
```

## 🔒 Security Testing

Security tests cover:
- Authentication and authorization
- Input validation and sanitization
- SQL injection prevention
- XSS prevention
- Rate limiting
- CORS configuration
- Security headers

Run security tests:
```bash
npm test -- __tests__/security
```

## ⚡ Performance Testing

Performance tests verify:
- Response times
- Concurrent request handling
- Database query performance
- Resource usage

Run performance tests:
```bash
npm test -- __tests__/performance
```

## 📈 Test Reports

### HTML Report
After running tests, view the HTML report:
```
Backend/reports/test-report.html
```

### Coverage Report
View coverage report:
```
Backend/coverage/lcov-report/index.html
```

### JUnit XML
For CI/CD integration:
```
Backend/reports/junit.xml
```

## 🔧 Configuration

### Jest Configuration
See `jest.config.js` for:
- Coverage thresholds
- Test environment setup
- Reporters configuration
- Coverage collection

### Environment Variables
Required for tests:
```bash
DATABASE_URL=postgresql://user:password@localhost:5432/test_db
JWT_SECRET=test-secret-key
SUPABASE_BUCKET=test-bucket
NODE_ENV=test
```

## 🎯 Best Practices

1. **Test Isolation**: Each test should be independent
2. **Clean Setup/Teardown**: Always clean up test data
3. **Descriptive Names**: Use clear test descriptions
4. **AAA Pattern**: Arrange, Act, Assert
5. **Mock External Services**: Don't call real APIs in tests
6. **Cover Edge Cases**: Test both success and failure paths
7. **Maintain Coverage**: Keep coverage above thresholds

## 🐛 Debugging Tests

### Run Single Test File
```bash
npm test -- auth.phone.spec.js
```

### Run Tests Matching Pattern
```bash
npm test -- --testNamePattern="should verify OTP"
```

### Debug Mode
```bash
npm run test:debug
```
Then attach debugger to `localhost:9229`

## 📦 CI/CD Integration

Tests run automatically on:
- Push to main/develop branches
- Pull requests
- Manual workflow dispatch

See `.github/workflows/test.yml` for configuration.

## 🔍 Code Quality

### Linting
```bash
npm run lint
```

### Formatting
```bash
npm run format
```

### Combined
```bash
npm run lint:format
```

## 📚 Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

## 🤝 Contributing

When adding new features:
1. Write tests first (TDD approach)
2. Ensure all tests pass
3. Maintain coverage thresholds
4. Update this documentation if needed

## 📞 Support

For questions or issues with the test suite, please contact the development team.

