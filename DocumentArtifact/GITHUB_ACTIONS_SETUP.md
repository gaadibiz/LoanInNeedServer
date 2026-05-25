# 🚀 GitHub Actions CI/CD Setup Guide

This guide will walk you through setting up GitHub Actions for the LoanInNeed Backend project.

## 📋 Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Step-by-Step Setup](#step-by-step-setup)
4. [Workflow Configuration](#workflow-configuration)
5. [GitHub Secrets Configuration](#github-secrets-configuration)
6. [Workflow Jobs Explained](#workflow-jobs-explained)
7. [Testing the Workflow](#testing-the-workflow)
8. [Troubleshooting](#troubleshooting)
9. [Advanced Configuration](#advanced-configuration)

## Overview

The GitHub Actions workflow (`ci.yml`) includes:

- ✅ **Code Quality Checks**: ESLint and Prettier formatting
- ✅ **Unit Tests**: Fast unit test execution
- ✅ **Integration Tests**: Full integration tests with PostgreSQL
- ✅ **Test Coverage**: Comprehensive coverage reporting
- ✅ **Docker Build**: Container image building and validation
- ✅ **Security Scanning**: npm audit and Snyk security checks

## Prerequisites

Before setting up GitHub Actions, ensure you have:

1. ✅ A GitHub repository for your project
2. ✅ All code committed and pushed to GitHub
3. ✅ GitHub account with appropriate permissions
4. ✅ (Optional) Codecov account for coverage reporting
5. ✅ (Optional) Snyk account for security scanning

## Step-by-Step Setup

### Step 1: Create GitHub Actions Directory

The workflow file has been created at `.github/workflows/ci.yml`. If it doesn't exist, create it:

```bash
mkdir -p .github/workflows
```

The file `.github/workflows/ci.yml` should already be in place.

### Step 2: Configure GitHub Secrets

Go to your GitHub repository and add the following secrets:

**Navigate to:** `Settings` → `Secrets and variables` → `Actions` → `New repository secret`

#### Required Secrets (for production-like testing):

1. **DATABASE_URL** (Optional for CI)
   - Format: `postgresql://user:password@host:port/database`
   - Used for: Integration tests (if you want to use a real database)
   - Note: The workflow uses a service container by default, so this is optional

2. **SUPABASE_URL** (Optional)
   - Your Supabase project URL
   - Format: `https://xxxxx.supabase.co`

3. **SUPABASE_SERVICE_KEY** (Optional)
   - Your Supabase service role key

4. **SUPABASE_BUCKET** (Optional)
   - Your Supabase storage bucket name

5. **TWILIO_ACCOUNT_SID** (Optional)
   - Your Twilio Account SID

6. **TWILIO_AUTH_TOKEN** (Optional)
   - Your Twilio Auth Token

7. **TWILIO_PHONE_NUMBER** (Optional)
   - Your Twilio phone number

#### Optional Secrets (for enhanced features):

8. **SNYK_TOKEN** (Optional)
   - For Snyk security scanning
   - Get it from: https://snyk.io/

9. **CODECOV_TOKEN** (Optional)
   - For Codecov coverage reporting
   - Get it from: https://codecov.io/

**Note:** The workflow will work with default test values if secrets are not provided, but for production-like testing, add the real values.

### Step 3: Verify Workflow File

Ensure the workflow file is committed:

```bash
git add .github/workflows/ci.yml
git commit -m "Add GitHub Actions CI/CD workflow"
git push origin main
```

### Step 4: Enable GitHub Actions

1. Go to your repository on GitHub
2. Click on the **Actions** tab
3. If prompted, click **"I understand my workflows, go ahead and enable them"**
4. The workflow will automatically run on:
   - Every push to `main` or `develop` branches
   - Every pull request to `main` or `develop` branches

## Workflow Configuration

### Trigger Events

The workflow triggers on:

```yaml
on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]
```

To modify triggers, edit `.github/workflows/ci.yml`.

### Environment Variables

The workflow uses these environment variables:

- `NODE_VERSION: '18'` - Node.js version
- `POSTGRES_VERSION: '15'` - PostgreSQL version for service container

## GitHub Secrets Configuration

### How to Add Secrets

1. **Go to Repository Settings:**
   - Navigate to: `https://github.com/YOUR_USERNAME/YOUR_REPO/settings/secrets/actions`

2. **Click "New repository secret"**

3. **Add each secret:**
   - **Name**: The secret name (e.g., `DATABASE_URL`)
   - **Value**: The secret value
   - **Click "Add secret"**

### Secret Reference Table

| Secret Name | Required | Description | Example |
|------------|----------|-------------|---------|
| `DATABASE_URL` | No | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `SUPABASE_URL` | No | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | No | Supabase service key | `eyJhbGc...` |
| `SUPABASE_BUCKET` | No | Supabase bucket name | `kyc-documents` |
| `TWILIO_ACCOUNT_SID` | No | Twilio Account SID | `ACxxxxx` |
| `TWILIO_AUTH_TOKEN` | No | Twilio Auth Token | `xxxxx` |
| `TWILIO_PHONE_NUMBER` | No | Twilio phone number | `+1234567890` |
| `SNYK_TOKEN` | No | Snyk API token | `xxxxx` |
| `CODECOV_TOKEN` | No | Codecov upload token | `xxxxx` |

## Workflow Jobs Explained

### 1. Code Quality Checks

**Job Name:** `code-quality`

**What it does:**
- Runs ESLint to check code quality
- Checks code formatting with Prettier

**Duration:** ~1-2 minutes

**Failure conditions:**
- ESLint errors
- Code formatting issues

### 2. Unit Tests

**Job Name:** `unit-tests`

**What it does:**
- Runs all unit tests (`npm run test:unit`)
- Generates coverage reports
- Uploads coverage to Codecov (if configured)

**Duration:** ~3-5 minutes

**Failure conditions:**
- Unit test failures
- Coverage below threshold (if configured)

### 3. Integration Tests

**Job Name:** `integration-tests`

**What it does:**
- Sets up PostgreSQL service container
- Runs database migrations
- Runs integration tests (`npm run test:integration`)
- Uploads coverage to Codecov

**Duration:** ~5-10 minutes

**Failure conditions:**
- Integration test failures
- Database connection issues

### 4. Full Test Suite & Coverage

**Job Name:** `test-coverage`

**What it does:**
- Runs all tests with coverage (`npm run test:coverage`)
- Generates comprehensive coverage reports
- Uploads test artifacts (reports, coverage)
- Uploads to Codecov

**Duration:** ~10-15 minutes

**Dependencies:** Waits for `code-quality` job

**Artifacts:**
- Coverage reports (HTML, LCOV, JSON)
- Test reports (JUnit XML, HTML)

### 5. Docker Build

**Job Name:** `docker-build`

**What it does:**
- Builds Docker image using Dockerfile
- Tests the Docker image
- Uses build cache for faster builds

**Duration:** ~5-8 minutes

**Dependencies:** Waits for `test-coverage` job

**Triggers:** Only on pushes to `main` or `develop` branches

### 6. Security Scan

**Job Name:** `security-scan`

**What it does:**
- Runs `npm audit` to check for vulnerabilities
- Runs Snyk security scan (if token provided)

**Duration:** ~2-3 minutes

**Note:** This job continues on error (won't fail the pipeline)

## Testing the Workflow

### Test 1: Push to Repository

1. Make a small change to your code
2. Commit and push:
   ```bash
   git add .
   git commit -m "Test GitHub Actions workflow"
   git push origin main
   ```
3. Go to the **Actions** tab on GitHub
4. You should see a workflow run starting

### Test 2: Create a Pull Request

1. Create a new branch:
   ```bash
   git checkout -b test-github-actions
   ```
2. Make a change and commit:
   ```bash
   git add .
   git commit -m "Test PR workflow"
   git push origin test-github-actions
   ```
3. Create a Pull Request to `main`
4. The workflow should automatically run

### Test 3: Check Workflow Status

1. Go to **Actions** tab
2. Click on the latest workflow run
3. Check each job status:
   - ✅ Green checkmark = Passed
   - ❌ Red X = Failed
   - 🟡 Yellow circle = In progress

## Troubleshooting

### Issue: Workflow Not Running

**Symptoms:** No workflow appears in Actions tab

**Solutions:**
1. Check if `.github/workflows/ci.yml` exists and is committed
2. Verify the file has correct YAML syntax
3. Check if GitHub Actions is enabled in repository settings
4. Ensure you're pushing to `main` or `develop` branch

### Issue: Tests Failing

**Symptoms:** Unit or integration tests fail

**Solutions:**
1. Check the test logs in the Actions tab
2. Run tests locally: `npm test`
3. Verify environment variables are set correctly
4. Check database connection (for integration tests)

### Issue: Docker Build Failing

**Symptoms:** Docker build job fails

**Solutions:**
1. Test Docker build locally: `docker build -t test .`
2. Check Dockerfile syntax
3. Verify all required files are in repository
4. Check build logs for specific errors

### Issue: Code Quality Checks Failing

**Symptoms:** ESLint or Prettier checks fail

**Solutions:**
1. Run locally: `npm run lint` and `npm run format:check`
2. Fix issues: `npm run lint:fix` and `npm run format`
3. Commit and push fixes

### Issue: Database Connection Issues

**Symptoms:** Integration tests can't connect to database

**Solutions:**
1. Verify PostgreSQL service container is running
2. Check `DATABASE_URL` format
3. Ensure migrations run before tests
4. Check service container health checks

### Issue: Coverage Upload Failing

**Symptoms:** Codecov upload fails

**Solutions:**
1. This is non-blocking (workflow continues)
2. Verify `CODECOV_TOKEN` is set (optional)
3. Check Codecov service status
4. Coverage reports are still saved as artifacts

## Advanced Configuration

### Customizing Workflow Triggers

Edit `.github/workflows/ci.yml`:

```yaml
on:
  push:
    branches: [ main, develop, feature/* ]
  pull_request:
    branches: [ main, develop ]
  schedule:
    - cron: '0 0 * * 0'  # Run weekly on Sunday
  workflow_dispatch:  # Allow manual triggering
```

### Adding Deployment Jobs

To add deployment to staging/production:

```yaml
deploy-staging:
  name: Deploy to Staging
  runs-on: ubuntu-latest
  needs: [test-coverage, docker-build]
  if: github.ref == 'refs/heads/develop'
  environment: staging
  steps:
    - name: Deploy to staging
      run: |
        # Your deployment commands here
```

### Matrix Testing

To test against multiple Node.js versions:

```yaml
strategy:
  matrix:
    node-version: [16, 18, 20]
steps:
  - uses: actions/setup-node@v4
    with:
      node-version: ${{ matrix.node-version }}
```

### Caching Dependencies

The workflow already uses npm cache, but you can add Prisma cache:

```yaml
- name: Cache Prisma
  uses: actions/cache@v3
  with:
    path: |
      node_modules/.prisma
      node_modules/@prisma
    key: ${{ runner.os }}-prisma-${{ hashFiles('**/prisma/schema.prisma') }}
```

### Notifications

Add Slack/Discord notifications:

```yaml
- name: Notify on failure
  if: failure()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

## Best Practices

1. ✅ **Keep workflows fast**: Use caching and parallel jobs
2. ✅ **Fail fast**: Run quick checks first (linting, unit tests)
3. ✅ **Use secrets**: Never commit sensitive data
4. ✅ **Test locally first**: Run tests before pushing
5. ✅ **Monitor regularly**: Check Actions tab for failures
6. ✅ **Review logs**: Understand why jobs fail
7. ✅ **Update dependencies**: Keep actions and tools updated

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [GitHub Actions Marketplace](https://github.com/marketplace?type=actions)
- [Prisma CI/CD Guide](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-production)
- [Docker GitHub Actions](https://docs.docker.com/ci-cd/github-actions/)

## Support

If you encounter issues:

1. Check the workflow logs in the Actions tab
2. Review this guide's troubleshooting section
3. Test commands locally
4. Check GitHub Actions status page
5. Review GitHub Actions documentation

---

**Last Updated:** 2025-01-XX
**Workflow Version:** 1.0.0

