# LoanInNeed Backend — Report Generation Prompts

Use the prompts below with Claude Code (or any LLM) to generate structured reports for testing, bugs, and workflow diagrams.

---

## 1. Code Testing Report

```
Analyze the test suite in the __tests__/ directory (unit/, integration/, security/, performance/) of the LoanInNeedServer project.

Generate a testing report that includes:

1. **Test Coverage Summary**
   - Total test files and test cases
   - Breakdown by category: unit, integration, security, performance
   - Pass / fail / skipped counts per category

2. **Module-Level Coverage**
   - Which controllers, services, routes, and middleware have tests
   - Which modules are untested or undertested

3. **Test Quality Assessment**
   - Are happy paths, error paths, and edge cases covered?
   - Are authentication/authorization flows tested?
   - Are database operations tested with real or mocked data?

4. **Test Configuration**
   - Summarize jest.config.js settings
   - Note any gaps in the current setup (e.g., missing coverage thresholds)

5. **Recommendations**
   - Priority areas to add or improve tests
   - Any flaky or redundant tests to clean up

Format as a markdown report with tables where appropriate.
```

---

## 2. Bug Report

```
Review the LoanInNeedServer codebase (Node.js / Express / PostgreSQL / Prisma) and identify bugs, vulnerabilities, and logic errors.

Generate a bug report that includes:

1. **Critical Bugs** (data loss, security breach, crash)
   - File path and line number
   - Description of the bug
   - Reproduction steps or conditions
   - Suggested fix

2. **High Severity Bugs** (incorrect business logic, broken API responses)
   - Same format as above

3. **Medium / Low Severity Issues** (code smells, missing validations, edge cases)
   - Same format as above

4. **Security Findings**
   - Input validation gaps
   - Authentication / authorization weaknesses
   - Sensitive data exposure risks
   - SQL injection or injection risks

5. **Dependency Issues**
   - Outdated or vulnerable packages (cross-reference package.json)

Format as a markdown table with columns: Severity | File | Line | Issue | Fix.
```

---

## 3. Workflow Diagram Prompt

```
Based on the LoanInNeedServer codebase (routes/, controllers/, services/, middleware/, models/), generate a Mermaid.js workflow diagram for the following flows:

### 3a. Loan Application Flow
diagram the end-to-end flow:
User Registration → OTP Verification → Login → Submit Loan Application → Credit Score Evaluation → EMI Calculation → Approval / Rejection → Notification

### 3b. API Request Lifecycle
diagram how a single API request travels through the system:
Incoming Request → CORS / Rate Limiter → Auth Middleware → Route Handler → Controller → Service → Prisma ORM → PostgreSQL → Response

### 3c. Authentication Flow
diagram the JWT + OTP authentication flow:
Request Login → Generate OTP → Send OTP (SMS/Email) → Verify OTP → Issue JWT → Refresh Token / Logout

### 3d. Role-Based Access Flow
diagram how different user roles (borrower, firm, admin) access different parts of the system.

Produce each diagram as a fenced Mermaid code block that can be pasted directly into a .md file or rendered at mermaid.live.
```

---

## 4. Full Combined Report

```
Generate a comprehensive quality report for the LoanInNeedServer Node.js backend project. The report should have four sections:

1. Executive Summary (2–3 sentences on overall health)
2. Testing Report (from the __tests__/ directory — coverage, gaps, recommendations)
3. Bug Report (critical to low severity, security findings, dependency risks)
4. Workflow Diagrams (Mermaid.js diagrams for loan flow, API lifecycle, auth, and RBAC)

Project context:
- Stack: Node.js, Express, PostgreSQL, Prisma ORM
- Domain: Digital lending platform (credit scoring, EMI, loan applications)
- Test runner: Jest (unit, integration, security, performance suites)
- Auth: JWT + OTP

Output as a single markdown document suitable for a technical stakeholder review.
```

---

## How to Use

1. Copy any prompt above into a Claude Code chat in this project directory.
2. Claude will read the relevant files and generate the report inline.
3. To save the output: ask Claude to write the result to `reports/test-report-<date>.md`.
4. For Mermaid diagrams, paste the output at [mermaid.live](https://mermaid.live) to render and export as PNG/SVG.
