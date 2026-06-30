# Node.js + MySQL Testing Guide

A structured approach to testing Node.js applications backed by a MySQL database.

---

## 1. Environment Setup

- Maintain a dedicated **test database** (e.g., `loaninneed_test`) — never run tests against production or staging data.
- Use a `.env.test` file to configure the test database connection separately from development/production.
- Ensure the test database schema is always in sync with production schema (run migrations before the test suite).
- Reset/seed the test database to a known state before each test run.

---

## 2. Testing Layers

### 2.1 Unit Tests

Test individual functions and modules in isolation.

- Mock all external dependencies: database connections, third-party APIs, file system.
- Focus on business logic, utility functions, validators, and transformers.
- Tools: **Jest**, **Mocha + Chai**, **Sinon** (for mocking/stubbing).

```
npm install --save-dev jest sinon
```

**What to test:**
- Input validation functions
- Data transformation/formatting utilities
- Error handling logic
- Business rule calculations (interest rates, loan amounts, etc.)

---

### 2.2 Integration Tests

Test how modules interact — especially the interaction between your application code and MySQL.

- Use a real MySQL test database (not mocks).
- Wrap each test in a transaction and **rollback** after, or truncate tables in `afterEach`/`afterAll` hooks.
- Test repository/service layers that execute queries.

**What to test:**
- CRUD operations against the test database
- Query correctness (joins, aggregations, filters)
- Constraint violations (unique keys, foreign keys, NOT NULL)
- Transaction behavior (commit and rollback paths)

**Example pattern (Jest + mysql2):**

```js
beforeAll(async () => {
  await db.query('BEGIN');
});

afterAll(async () => {
  await db.query('ROLLBACK');
  await db.end();
});
```

---

### 2.3 API / Route Tests (End-to-End at the HTTP layer)

Test your Express routes end-to-end using a real or in-memory HTTP server.

- Use **Supertest** to send HTTP requests without starting a live server.
- Seed the database with known fixtures before each test.
- Assert HTTP status codes, response body structure, and headers.

```
npm install --save-dev supertest
```

**What to test:**
- Happy path for every endpoint (200/201 responses)
- Authentication and authorization (valid token, expired token, missing token)
- Input validation errors (400 responses)
- Not found cases (404 responses)
- Conflict/duplicate scenarios (409 responses)
- Database error handling (500 responses)

---

### 2.4 Database Migration Tests

Verify that your SQL migrations apply cleanly and are reversible.

- Run `migrate up` on a blank test database and assert the schema matches expectations.
- Run `migrate down` and assert the rollback completes without errors.
- Check that seed data inserts without constraint violations after migration.

---

## 3. Test Data Management

- Use a **seed script** to populate the test database with realistic, minimal fixture data.
- Never hardcode IDs — query for inserted records or use returned insert IDs.
- Clean up test data in `afterEach` or use database transactions to roll back.
- Use **factories** (e.g., `fishery`, `factory-girl`) to generate test objects with sensible defaults.

---

## 4. Code Coverage

- Aim for **80%+ coverage** on business logic; 100% is rarely practical.
- Use Jest's built-in coverage reporter or `nyc` for Mocha.

```
jest --coverage
```

- Review uncovered branches, not just line coverage — a covered line with an untested branch is a gap.
- Exclude generated files, migrations, and config from coverage reports.

---

## 5. Test Naming Convention

Use descriptive, behavior-focused test names:

```
describe('LoanService', () => {
  describe('applyForLoan', () => {
    it('should return 400 when loan amount exceeds eligibility limit')
    it('should insert a pending loan record on valid input')
    it('should rollback the transaction if notification fails')
  })
})
```

Format: **"should [expected behavior] when [condition]"**

---

## 6. CI/CD Integration

- Run the full test suite on every pull request (GitHub Actions, GitLab CI, etc.).
- Block merges if any test fails or coverage drops below the threshold.
- Run tests against the same MySQL version used in production.

**Example GitHub Actions step:**

```yaml
- name: Run Tests
  env:
    DB_HOST: 127.0.0.1
    DB_USER: root
    DB_PASSWORD: root
    DB_NAME: loaninneed_test
  run: npm test
```

---

## 7. Common Pitfalls to Avoid

| Pitfall | Fix |
|---|---|
| Tests sharing state through a common database | Isolate with transactions or truncate tables in hooks |
| Hardcoded test IDs that break on re-seed | Query for records dynamically |
| Testing against production DB | Always use a dedicated test DB |
| Skipping error-path tests | Explicitly test every failure branch |
| Order-dependent tests | Each test must be fully self-contained |
| No assertion on response body structure | Assert exact fields, not just status code |

---

## 8. Recommended Tools Summary

| Purpose | Tool |
|---|---|
| Test runner | Jest |
| HTTP layer testing | Supertest |
| Mocking / stubbing | Sinon |
| MySQL client | mysql2 |
| Code coverage | Jest `--coverage` or nyc |
| Test data factories | fishery or factory-girl |
| Environment config | dotenv |

---

## 9. Running Tests

```bash
# Run all tests
npm test

# Run with coverage report
npm test -- --coverage

# Run a specific test file
npx jest src/services/loan.test.js

# Run tests matching a name pattern
npx jest --testNamePattern="applyForLoan"

# Watch mode during development
npx jest --watch
```

---

## 10. Test File Structure

```
src/
  services/
    loan.service.js
    loan.service.test.js        # unit test alongside source
  routes/
    loan.route.js
    loan.route.test.js          # route/integration test
tests/
  integration/
    db.loan.test.js             # database integration tests
  fixtures/
    seed.js                     # test data seeding script
  helpers/
    db.js                       # shared test DB connection setup
```

---

*Follow this guide consistently to catch regressions early, maintain confidence in deployments, and keep the codebase reliable as it grows.*
