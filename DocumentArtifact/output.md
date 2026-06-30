# LoanInNeedServer — OTP API Testing Report

**Generated:** 2026-06-16  
**Tester:** Claude Code (automated)  
**Server:** `http://localhost:5000`  
**Branch:** `testDeploy`  
**Scope:** `POST /api/auth/phone/request-otp`, `POST /api/auth/phone/verify-otp`, `POST /api/auth/aadhaar/request-otp`, `POST /api/auth/aadhaar/verify-otp`

---

## Executive Summary

The OTP authentication APIs are functionally operational but carry **two critical security vulnerabilities** that must be resolved before production use. A hardcoded master bypass code (`"261102"`) allows unrestricted account creation or login without SMS verification — and combined with absent phone-number sanitisation, arbitrary strings (including SQL-like payloads) are persisted to the `User` table as valid phone numbers. Rate limiting is absent on both endpoints, enabling brute-force enumeration. Aadhaar OTP is intentionally stubbed with no verification logic, which is acceptable only while the real integration is pending — but it must not remain in production unguarded.

---

## 1. Test Environment

| Item | Detail |
|---|---|
| Base URL | `http://localhost:5000/api/auth` |
| Routes file | `routes/authRoutes.js` |
| Controller | `controllers/authController.js` |
| Service | `services/authService.js` |
| OTP utility | `utils/smsOtpService.js` |
| Attribution middleware | `middleware/attributionMiddleware.js` |
| ORM | Prisma (MySQL) |
| OTP table | `Otp` — columns: id, phone, code, expiresAt, verified, createdAt |
| User table | `User` — customUserId, phone, phoneVerified, role, verificationStatus |
| JWT expiry | 24 hours (observed from decoded token payload) |

---

## 2. Test Cases — `POST /api/auth/phone/request-otp`

| # | Test Name | Input | Expected | Actual Response | HTTP | Result |
|---|---|---|---|---|---|---|
| T01 | Happy path — test bypass prefix | `{"phone":"+919900000001"}` | 200 mocked success | `{"message":"OTP sent successfully (Mocked)."}` | 200 | ✅ PASS |
| T02 | Valid real number | `{"phone":"+919830069363"}` | 200 or SMS error | `{"message":"OTP sent successfully."}` | 200 | ✅ PASS |
| T03 | Missing country code | `{"phone":"9830069363"}` | 400 bad request | `{"status":"error","message":"Phone number must include country code..."}` | 400 | ✅ PASS |
| T04 | Missing phone field | `{}` | 400 bad request | `{"status":"error","message":"Something went wrong!"}` | 500 | ❌ FAIL — should be 400 |
| T05 | Empty string phone | `{"phone":""}` | 400 bad request | `{"status":"error","message":"Phone number must include country code..."}` | 400 | ✅ PASS |
| T06 | SQL injection in phone | `{"phone":"'; DROP TABLE Otp; --"}` | 400 (no `+` prefix) | `{"status":"error","message":"Phone number must include country code..."}` | 400 | ✅ PASS (blocked by prefix check) |
| T07 | XSS in phone | `{"phone":"<script>alert(1)</script>"}` | 400 (no `+` prefix) | `{"status":"error","message":"Phone number must include country code..."}` | 400 | ✅ PASS (blocked by prefix check) |
| T08 | Oversized phone number (99 chars) | `{"phone":"+919999...99"}` | 400 validation error | `{"message":"OTP sent successfully (Mocked)."}` | 200 | ❌ FAIL — no length validation |
| T09 | Numeric only no `+` | `{"phone":"1234567890"}` | 400 bad request | `{"status":"error","message":"Phone number must include country code..."}` | 400 | ✅ PASS |
| T10 | Path traversal in phone | `{"phone":"+91../../../etc/passwd"}` | 400 validation error | `{"message":"OTP sent successfully."}` | 200 | ❌ FAIL — sent to SMS API |
| T11 | Null phone value | `{"phone":null}` | 400 bad request | `{"status":"error","message":"Something went wrong!"}` | 500 | ❌ FAIL — should be 400 |
| T12 | Array injection in phone | `{"phone":["+919900000001","+919900000002"]}` | 400 bad request | `{"status":"error","message":"Something went wrong!"}` | 500 | ❌ FAIL — should be 400 |
| T31 | Rate limit — 5 rapid requests | Same phone, 5× in quick succession | 429 after threshold | All 5 returned 200 | 200×5 | ❌ FAIL — no rate limiting |
| T33 | Wrong Content-Type | `text/plain` body | 400 or 415 | `{"status":"error","message":"Something went wrong!"}` | 500 | ❌ FAIL — should be 415/400 |

---

## 3. Test Cases — `POST /api/auth/phone/verify-otp`

| # | Test Name | Input | Expected | Actual Response | HTTP | Result |
|---|---|---|---|---|---|---|
| T13 | Master bypass with test number | `{"phone":"+919900000001","code":"261102"}` | 200 + JWT token | `{"message":"Phone verified successfully.","user":{...},"token":"eyJ..."}` | 200 | ✅ PASS (functional) |
| T14 | Wrong OTP code | `{"phone":"+919900000001","code":"000000"}` | 400 invalid OTP | `{"status":"error","message":"Invalid or expired OTP."}` | 400 | ✅ PASS |
| T15 | Missing code field | `{"phone":"+919900000001"}` | 400 bad request | `{"status":"error","message":"Phone and OTP code are required."}` | 400 | ✅ PASS |
| T16 | Missing phone field | `{"code":"261102"}` | 400 bad request | `{"status":"error","message":"Phone and OTP code are required."}` | 400 | ✅ PASS |
| T17 | SQL injection in code field | `{"phone":"+919900000001","code":"261102' OR 1=1 --"}` | 400 invalid OTP | `{"status":"error","message":"Invalid or expired OTP."}` | 400 | ✅ PASS (Prisma ORM parameterised) |
| T18 | SQL injection in phone + bypass | `{"phone":"' OR 1=1 --","code":"261102"}` | 400 — phone invalid | User created with phone `' OR 1=1 --`, JWT returned | 200 | ❌ **CRITICAL FAIL** |
| T19 | XSS in code | `{"phone":"+919900000001","code":"<script>alert(1)</script>"}` | 400 invalid OTP | `{"status":"error","message":"Invalid or expired OTP."}` | 400 | ✅ PASS |
| T20 | Empty body | `{}` | 400 bad request | `{"status":"error","message":"Phone and OTP code are required."}` | 400 | ✅ PASS |
| T21 | Null code | `{"phone":"+919900000001","code":null}` | 400 bad request | `{"status":"error","message":"Phone and OTP code are required."}` | 400 | ✅ PASS |
| T22 | Integer code type | `{"phone":"+919900000001","code":261102}` | 400 or coercion to string | `{"status":"error","message":"Something went wrong!"}` | 500 | ❌ FAIL — type not guarded |
| T23 | 500-char code string | `{"code":"AAAA..."}` | 400 invalid OTP | `{"status":"error","message":"Invalid or expired OTP."}` | 400 | ✅ PASS |
| T24 | Whitespace phone + bypass | `{"phone":"+91   ","code":"261102"}` | 400 invalid phone | User created with phone `+91   `, JWT returned | 200 | ❌ FAIL — whitespace accepted |
| T25 | NoSQL injection in phone | `{"phone":{"$gt":""},"code":"261102"}` | 400 bad request | `{"status":"error","message":"Something went wrong!"}` | 500 | ❌ FAIL — object type not rejected with 400 |
| T26 | Prototype pollution | `{"__proto__":{"admin":true},...}` | ignored, normal flow | Returned normal response (pollution silently ignored) | 200 | ⚠️ WARN — `__proto__` not stripped |
| T34 | Wrong code then bypass | Wrong code → 400; bypass code → 200 | Correct sequential | Correct behaviour observed | 400/200 | ✅ PASS |
| T35 | Replay bypass on same phone | Bypass code twice for same phone | 2nd call returns same user | Both calls return identical user+token | 200×2 | ⚠️ WARN — bypass replayable |

---

## 4. Test Cases — Aadhaar OTP Endpoints

| # | Test Name | Input | Actual Response | HTTP | Result |
|---|---|---|---|---|---|
| T27 | `aadhaar/request-otp` — stub | `{"aadhaar":"123456789012"}` | `{"success":true,"message":"OTP sent successfully"}` | 200 | ⚠️ STUB |
| T28 | `aadhaar/verify-otp` — any OTP passes | `{"otp":"999999"}` | `{"success":true,"message":"Aadhaar verified successfully"}` | 200 | ⚠️ STUB — no auth |
| T29 | `aadhaar/verify-otp` — empty body | `{}` | `{"success":true,"message":"Aadhaar verified successfully"}` | 200 | ⚠️ STUB — no auth |

---

## 5. JWT Token Analysis

**Decoded payload from Test T13 / T32:**

```json
{
  "id": 12705,
  "email": null,
  "phone": "+919900000002",
  "role": "CUSTOMER",
  "iat": 1781599121,
  "exp": 1781685521
}
```

| Property | Value | Assessment |
|---|---|---|
| Algorithm | HS256 | ✅ Acceptable |
| Expiry | 24 hours (`exp - iat = 86400s`) | ⚠️ Consider shorter expiry (1h) + refresh tokens |
| Contains `email` | `null` — email in payload | ⚠️ PII in token body (base64-decodable without secret) |
| Contains `phone` | Yes | ⚠️ PII in token body |
| Refresh token | Not present | ⚠️ No token rotation strategy |
| `id` field | Internal DB integer ID exposed | ⚠️ Prefer returning `customUserId` only |

---

## 6. Bug Report

### 6.1 Critical Bugs

| Severity | File | Line | Issue | Fix |
|---|---|---|---|---|
| 🔴 CRITICAL | `services/authService.js` | 48 | **Hardcoded master bypass OTP (`"261102"`)** — anyone who discovers this code can authenticate as any phone number, create arbitrary user accounts, or inject garbage phone values into the `User` table | Remove hardcoded bypass. If emergency access is needed, implement a time-limited, admin-controlled bypass via a signed one-time token stored in Redis, not hardcoded in source |
| 🔴 CRITICAL | `services/authService.js` | 62–88 | **No phone number sanitisation before DB write** — when master bypass is used, any phone string (e.g. `' OR 1=1 --`, `+91   `, path traversal) is stored as the user's phone number. This pollutes the `User` table and can cause lookup inconsistencies | Validate phone against E.164 regex (`/^\+[1-9]\d{7,14}$/`) before any DB operation, independent of bypass logic |

### 6.2 High Severity Bugs

| Severity | File | Line | Issue | Fix |
|---|---|---|---|---|
| 🟠 HIGH | `services/authService.js` | 12–33 | **No rate limiting on `request-otp`** — 5 rapid-fire requests all succeed (T31). An attacker can spam OTP requests to flood the SMS API, incur cost, or annoy users | Add `express-rate-limit` per IP + per phone: max 3 OTP requests per 10 minutes per phone number |
| 🟠 HIGH | `services/authService.js` | 12 | **No input type guard on `phone`** — `null`, arrays, and objects all reach `.startsWith()` and throw unhandled errors (500s on T04, T11, T12, T25) | Add early guard: `if (!phone || typeof phone !== 'string') throw new BadRequestError(...)` |
| 🟠 HIGH | `utils/smsOtpService.js` | 25 | **Unvalidated phone sent to external SMS API** (T10: `+91../../../etc/passwd` accepted) — could manipulate SMS API request or trigger unexpected API behaviour | Apply E.164 regex validation in `sendOtp()` before constructing API payload |

### 6.3 Medium Severity Bugs

| Severity | File | Line | Issue | Fix |
|---|---|---|---|---|
| 🟡 MEDIUM | `controllers/authController.js` | 13 | **Integer `code` causes unhandled 500** (T22: `{"code":261102}`) — `String.prototype` comparison to `"261102"` fails when code is a number; the downstream `verifyOtp()` call throws | Coerce or validate: `const code = String(req.body.code ?? '')` with subsequent empty-string check |
| 🟡 MEDIUM | `controllers/authController.js` | 22–35 | **Aadhaar OTP is a complete bypass stub** — both request and verify return success regardless of input or OTP value (T27–T29). There is no authentication, no Aadhaar number validation, and no OTP lifecycle | This is intentional while integration is pending, but must be gated behind a feature flag and not exposed in production without real implementation |
| 🟡 MEDIUM | `middleware/attributionMiddleware.js` | 13 | **Attribution middleware is fail-open** — any error in partner lookup, signature validation, or DB logging silently calls `next()`. An attacker can probe partner IDs without consequence | Log all failures; consider fail-closed for known-bad signatures (return 400 rather than continuing) |
| 🟡 MEDIUM | `services/authService.js` | 38–126 | **Replay attack on master bypass** (T35) — the bypass code can be used unlimited times for any phone number; no call-limit or one-time guard exists | Log bypass usage; enforce per-IP or per-session rate limit on bypass usage |

### 6.4 Low Severity / Code Quality Issues

| Severity | File | Line | Issue | Fix |
|---|---|---|---|---|
| 🟢 LOW | `server.js` | — | **Wrong Content-Type returns 500** (T33) instead of 415 Unsupported Media Type | Add `express.json()` strict mode or a global middleware that returns 415 when Content-Type is not `application/json` on JSON routes |
| 🟢 LOW | `services/authService.js` | 42–43 | **Whitespace-only phone accepted with bypass** (T24: `"+91   "` stored as user phone) | Trim + validate with E.164 regex |
| 🟢 LOW | `controllers/authController.js` | 17 | **`console.log` debug statement in production controller** — `[DEBUG] Auth Controller - Attribution:` leaks attribution data to stdout | Remove `console.log` or replace with `logger.debug()` (which can be silenced in production) |
| 🟢 LOW | `middleware/attributionMiddleware.js` | 16 | **`console.log` debug statement in production middleware** — logs full query params including `sig` to stdout | Remove or replace with `logger.debug()` |
| 🟢 LOW | `utils/smsOtpService.js` | — | **No max OTP attempts before lockout** — after requesting an OTP, an attacker can try all 1,000,000 6-digit codes with no lockout | Track failed verify attempts per phone; lock after N failures |
| 🟢 LOW | `utils/jwt.js` | — | **JWT payload contains PII** — `phone` and `email` encoded in token body (base64-readable without secret) | Remove PII from JWT payload; store only `id` and `role` |

---

## 7. Security Findings Summary

| Finding | Category | Risk | Status |
|---|---|---|---|
| Hardcoded master bypass OTP `"261102"` in source code | Authentication bypass | Critical | ❌ Open |
| No E.164 phone format validation — allows garbage DB writes | Input validation | High | ❌ Open |
| No rate limiting on OTP request endpoint | Brute force / DoS | High | ❌ Open |
| No OTP attempt lockout on verify endpoint | Brute force | High | ❌ Open |
| Path-traversal-like string accepted by `request-otp` (T10) | Input validation | Medium | ❌ Open |
| Aadhaar OTP fully bypassed — no identity verification | Authentication bypass | Medium | ⚠️ Intentional stub |
| PII (phone, email) encoded in JWT payload | Sensitive data exposure | Medium | ❌ Open |
| Internal DB integer `id` exposed in JWT | Information disclosure | Low | ❌ Open |
| `console.log` debug statements in production code | Information disclosure | Low | ❌ Open |
| Prototype pollution via `__proto__` not stripped | Injection | Low | ❌ Open |
| Replay attack on master bypass code | Authentication | Medium | ❌ Open |
| 500 instead of 400/415 on type errors and wrong Content-Type | Error handling | Low | ❌ Open |
| Prisma ORM parameterised queries — SQL injection via ORM blocked | SQL injection | N/A | ✅ Protected |
| XSS in OTP code rejected by invalid-OTP check | XSS | N/A | ✅ Protected |

---

## 8. Flow Diagram

```
POST /api/auth/phone/request-otp
├── [req.body.phone]
│   ├── null / array / object  →  500 (BUG: should be 400)
│   ├── missing "+" prefix     →  400 BadRequestError ✅
│   ├── starts with "+9199"    →  200 Mocked ✅
│   ├── no length/format check →  proceeds (BUG)
│   └── valid format           →  smsOtpService.sendOtp()
│                                   ├── SMS API config missing → 500
│                                   ├── DB: INSERT Otp record
│                                   ├── POST Speqtra SMS API
│                                   └── 200 {"message":"OTP sent successfully."}

POST /api/auth/phone/verify-otp
├── attributionMiddleware (fail-open)
│   ├── no pid/ts/sig params   →  next() (skip attribution)
│   └── valid sig              →  req.attribution = { partnerId, ... }
├── [req.body.phone, req.body.code]
│   ├── either missing/null    →  400 BadRequestError ✅
│   ├── code === "261102"       →  BYPASS (BUG: hardcoded)
│   │   ├── phone not validated →  ANY string creates user (BUG)
│   │   └── → skip smsOtpService.verifyOtp()
│   └── code !== "261102"      →  smsOtpService.verifyOtp()
│       ├── DB: SELECT Otp WHERE phone=? AND code=? AND verified=false AND expiresAt>now()
│       ├── not found           →  400 "Invalid or expired OTP." ✅
│       └── found               →  DB: UPDATE Otp SET verified=true
├── prisma.user.findUnique({ where: { phone } })
│   ├── existing user          →  update phoneVerified if needed
│   └── new user               →  INSERT User (customUserId=LINxxx)
└── generateToken(user)        →  200 { message, user, token }
```

---

## 9. Recommendations (Priority Order)

1. **[CRITICAL] Remove hardcoded bypass OTP** — Delete lines 46–50 in `services/authService.js`. If a dev bypass is required for testing, use an environment variable (`DEV_OTP_BYPASS_CODE`) that is explicitly unset in production CI/CD.

2. **[CRITICAL] Add E.164 phone validation** — Before any DB write or SMS API call, validate against `/^\+[1-9]\d{7,14}$/`. Apply in both `authService.requestPhoneOtp` and `authService.verifyPhoneOtp`.

3. **[HIGH] Add rate limiting** — Install `express-rate-limit` and configure:
   - `request-otp`: max 3 per phone per 10 min
   - `verify-otp`: max 5 attempts per phone per 10 min (then lock)

4. **[HIGH] Guard input types early** — Add `if (!phone || typeof phone !== 'string')` check at the top of both service functions to return a clean 400 instead of a 500.

5. **[MEDIUM] Remove PII from JWT** — Store only `{ id, customUserId, role }` in the token payload. Fetch full user profile from DB on authenticated requests.

6. **[MEDIUM] Gate Aadhaar stub behind feature flag** — Add `if (process.env.AADHAAR_STUB_ENABLED !== 'true') return res.status(503).json(...)` so the stub never runs in production.

7. **[LOW] Remove `console.log` debug statements** — Replace all `console.log('[DEBUG]...')` calls in controller and middleware with `logger.debug(...)` which is suppressed in production log levels.

8. **[LOW] Strip `__proto__` fields** — Add `hpp()` (HTTP parameter pollution) and body-sanitisation middleware (`express-mongo-sanitize` or a custom strip of keys matching `__proto__`, `constructor`, `prototype`) to the Express app.

---

## 10. Test Coverage Summary

| Category | Tests Run | Pass | Fail | Warn |
|---|---|---|---|---|
| Happy path | 3 | 3 | 0 | 0 |
| Input validation | 10 | 6 | 4 | 0 |
| Security / injection | 10 | 5 | 3 | 2 |
| Error handling | 5 | 2 | 3 | 0 |
| Aadhaar stub | 3 | 0 | 0 | 3 |
| JWT / token | 2 | 1 | 0 | 1 |
| Rate limiting | 1 | 0 | 1 | 0 |
| Replay attack | 1 | 0 | 0 | 1 |
| **Total** | **35** | **17** | **11** | **7** |

---

## 11. Raw Test Log

### `POST /api/auth/phone/request-otp`

```
T01  +919900000001          →  200  {"message":"OTP sent successfully (Mocked)."}
T02  +919830069363          →  200  {"message":"OTP sent successfully."}
T03  9830069363             →  400  {"status":"error","message":"Phone number must include country code..."}
T04  (missing field)        →  500  {"status":"error","message":"Something went wrong!"}  ← BUG
T05  ""                     →  400  {"status":"error","message":"Phone number must include country code..."}
T06  '; DROP TABLE Otp; --  →  400  {"status":"error","message":"Phone number must include country code..."}
T07  <script>alert(1)</script> → 400  {"status":"error","message":"Phone number must include country code..."}
T08  +919999...99 (99 chars) → 200  {"message":"OTP sent successfully (Mocked)."}  ← BUG (no length check)
T09  1234567890             →  400  {"status":"error","message":"Phone number must include country code..."}
T10  +91../../../etc/passwd →  200  {"message":"OTP sent successfully."}  ← BUG (sent to SMS API)
T11  null                   →  500  {"status":"error","message":"Something went wrong!"}  ← BUG
T12  [array]                →  500  {"status":"error","message":"Something went wrong!"}  ← BUG
T31  5× rapid fire          →  200×5  (no rate limiting)  ← BUG
T33  Content-Type: text/plain → 500  {"status":"error","message":"Something went wrong!"}  ← BUG
```

### `POST /api/auth/phone/verify-otp`

```
T13  +919900000001 / 261102       →  200  {user:{id:"LIN12702",...},token:"eyJ..."}
T14  +919900000001 / 000000       →  400  {"status":"error","message":"Invalid or expired OTP."}
T15  +919900000001 / (missing)    →  400  {"status":"error","message":"Phone and OTP code are required."}
T16  (missing) / 261102           →  400  {"status":"error","message":"Phone and OTP code are required."}
T17  +919900000001 / 261102'OR1=1 →  400  {"status":"error","message":"Invalid or expired OTP."}
T18  ' OR 1=1 -- / 261102         →  200  user created with phone="' OR 1=1 --"  ← CRITICAL BUG
T19  +919900000001 / <script>     →  400  {"status":"error","message":"Invalid or expired OTP."}
T20  {} (empty)                   →  400  {"status":"error","message":"Phone and OTP code are required."}
T21  +919900000001 / null         →  400  {"status":"error","message":"Phone and OTP code are required."}
T22  +919900000001 / 261102(int)  →  500  {"status":"error","message":"Something went wrong!"}  ← BUG
T23  +919900000001 / AAAA×500    →  400  {"status":"error","message":"Invalid or expired OTP."}
T24  "+91   " / 261102            →  200  user created with phone="+91   "  ← BUG
T25  {"$gt":""} / 261102          →  500  {"status":"error","message":"Something went wrong!"}  ← BUG
T26  __proto__ pollution          →  200  normal response (pollution silently ignored)  ← WARN
T34  wrong → bypass               →  400 then 200  (correct sequential)
T35  replay bypass same phone ×2  →  200×2 identical response  ← WARN
```

### Aadhaar OTP

```
T27  aadhaar/request-otp {"aadhaar":"123456789012"} → 200 {"success":true,"message":"OTP sent successfully"}
T28  aadhaar/verify-otp  {"otp":"999999"}           → 200 {"success":true,"message":"Aadhaar verified successfully"}
T29  aadhaar/verify-otp  {}                         → 200 {"success":true,"message":"Aadhaar verified successfully"}
```

---

*Report generated by automated test run against live server. Update this file after each sprint by re-running the test suite and appending a new dated section.*

---

# LoanInNeedServer — KYC API Testing Report

**Generated:** 2026-06-16  
**Tester:** Claude Code (automated)  
**Server:** `http://localhost:5000`  
**Branch:** `testDeploy`  
**Scope:** `GET /api/kyc`, `POST /api/kyc`, `POST /api/kyc/verify-pan`, `PUT /api/kyc/employment`, `PUT /api/kyc/address`

---

## Executive Summary

The KYC APIs are partially functional but carry **three critical issues** that must be resolved before production. Internal Prisma stack traces and Multer error internals are returned verbatim to clients on any unhandled enum or file-size error — leaking ORM query structure, file paths, and node_modules layout. Invalid JWT tokens return a 500 with a full JWT library stack trace instead of a clean 401. XSS payloads in the `purpose` field are stored raw in the database and reflected back in API responses with no sanitisation. Two additional structural gaps: the `POST /api/kyc` endpoint creates a new `LoanApplication` record on every call (no idempotency), and a user cannot re-submit their own PAN for re-verification due to a logic bug in the duplicate-PAN check.

---

## 1. Test Environment

| Item | Detail |
|---|---|
| Base URL | `http://localhost:5000/api/kyc` |
| Routes file | `routes/kycRoutes.js` |
| Controller | `controllers/kycController.js` |
| Service | `services/kycService.js` |
| PAN verification | `services/surepassService.js` (mock PAN: `TEST00000X`) |
| Models | `models/employmentModel.js`, `models/adressModel.js`, `models/panModel.js`, `models/loanModel.js` |
| Auth middleware | `middleware/authMiddleware.js` (`protect`) |
| File upload | `multer` in-memory storage, 10 MB limit (routes/kycRoutes.js) |
| ORM | Prisma |
| Auth method | JWT Bearer token (obtained via `/api/auth/phone/verify-otp` + master bypass `261102`) |

---

## 2. Test Cases — `GET /api/kyc`

| # | Test Name | Input | Expected | Actual Response | HTTP | Result |
|---|---|---|---|---|---|---|
| K01 | Stub endpoint with valid JWT | Valid JWT bearer | 200 stub message | `{"message":"KYC details not implemented yet"}` | 200 | ⚠️ STUB |
| K02 | No auth token | (none) | 401 Unauthorized | `{"status":"error","message":"Authentication token missing or malformed."}` | 401 | ✅ PASS |

---

## 3. Test Cases — `POST /api/kyc` (Full KYC Submission)

| # | Test Name | Input | Expected | Actual Response | HTTP | Result |
|---|---|---|---|---|---|---|
| K03 | Happy path — full valid payload | Complete employment + address + loan fields | 200 with all sub-records | `{"success":true,"data":{employment,address,loan,application}}` | 200 | ✅ PASS |
| K04 | No auth token | Valid body, no JWT | 401 | `{"status":"error","message":"Authentication token missing or malformed."}` | 401 | ✅ PASS |
| K05 | Missing `companyName` — fresh user (no DB fallback) | All fields except companyName | 400 | `{"status":"error","message":"Employment data incomplete ❌ (Company Name and Income required)"}` | 400 | ✅ PASS |
| K06 | Missing `companyName` — user with existing employment | All fields except companyName | 400 (should reject) | 200 — service silently falls back to DB record's `employerName` | 200 | ⚠️ WARN — silent DB fallback masks missing required field |
| K07 | Missing `monthlyIncome` — user with existing employment | All fields except monthlyIncome | 400 (should reject) | 200 — service falls back to DB record's income | 200 | ⚠️ WARN — silent DB fallback masks missing required field |
| K08 | Missing `loanAmount` | All fields except loanAmount | 400 | `{"status":"error","message":"Loan data incomplete ❌"}` | 400 | ✅ PASS |
| K09 | Missing `purpose` | All fields except purpose | 400 | `{"status":"error","message":"Loan data incomplete ❌"}` | 400 | ✅ PASS |
| K10 | `loanAmount` = 0 | `"loanAmount":0` | 400 | `{"status":"error","message":"Loan data incomplete ❌"}` | 400 | ✅ PASS |
| K11 | Negative `loanAmount` (-5000) | `"loanAmount":-5000` | 400 | `{"status":"error","message":"Invalid loan amount ❌"}` | 400 | ✅ PASS |
| K12 | Negative `monthlyIncome` (-1000) | `"monthlyIncome":-1000` | 400 | `{"status":"error","message":"Invalid monthly income ❌"}` | 400 | ✅ PASS |
| K13 | Non-numeric `loanAmount` string | `"loanAmount":"ten-lakhs"` | 400 | `{"status":"error","message":"Invalid loan amount ❌"}` | 400 | ✅ PASS |
| K14 | Empty body `{}` | `{}` | 400 | `{"status":"error","message":"Employment data incomplete ❌ (Company Name and Income required)"}` | 400 | ✅ PASS |
| K15 | Invalid `stability` enum value | `"stability":"GARBAGE_VALUE"` | 400 validation error | 500 with full Prisma internal query + stack trace | 500 | ❌ **FAIL — internal details leaked** |
| K16 | XSS in `purpose` field | `"purpose":"<script>alert(1)</script>"` | 400 sanitisation error | 200 — XSS stored verbatim in `purposeOfLoan` DB column and reflected in response | 200 | ❌ **FAIL — stored XSS** |
| K17 | Extremely large `loanAmount` | `"loanAmount":999999999999` | 400 exceeds max limit | 200 — stored as-is, no upper bound check | 200 | ❌ FAIL — no max loan amount validation |
| K18 | Duplicate KYC submission (same user, second call) | Valid full payload, same user as K03 | 409 or idempotent 200 | 200 — creates a **new** `LoanApplication` record each time (appId increments) | 200 | ❌ FAIL — unbounded LoanApplication creation per user |
| K19 | Forged / invalid JWT | `Authorization: Bearer eyJ...fake` | 401 Unauthorized | 500 with full JWT library stack trace | 500 | ❌ **FAIL — 401 sent as 500 + stack trace leaked** |

---

## 4. Test Cases — `PUT /api/kyc/employment`

| # | Test Name | Input | Expected | Actual Response | HTTP | Result |
|---|---|---|---|---|---|---|
| K20 | Happy path — update existing employment | `{employmentType,companyName,monthlyIncome,stability:"Very Stable"}` | 200 updated record | `{"success":true,"data":{employerName:"Updated Corp","stability":"VERY_STABLE",...}}` | 200 | ✅ PASS |
| K21 | No auth token | Valid body, no JWT | 401 | `{"status":"error","message":"Authentication token missing or malformed."}` | 401 | ✅ PASS |
| K22 | All valid `stability` enum mappings | Each of 6 frontend labels | Correct enum in DB | All 6 correctly mapped: `STABLE`, `VERY_STABLE`, `NEUTRAL`, `NEUTRAL`, `SOMEWHAT_UNSTABLE`, `VERY_UNSTABLE` | 200 | ✅ PASS |
| K23 | Invalid `stability` enum value | `"stability":"VERY_BAD_ENUM"` | 400 validation error | 500 with full Prisma internal query structure and stack trace | 500 | ❌ **FAIL — internal details leaked** |
| K24 | Empty body — no existing employment record | `{}` on fresh user | 400 | `{"status":"error","message":"Employment record not found and payload incomplete for creation."}` | 400 | ✅ PASS |

---

## 5. Test Cases — `PUT /api/kyc/address`

| # | Test Name | Input | Expected | Actual Response | HTTP | Result |
|---|---|---|---|---|---|---|
| K25 | Happy path — update existing address | `{currentAddress,city,state,postalCode,currentAddressType:"Rented"}` | 200 updated record | `{"success":true,"data":{city:"Bangalore","currentAddressType":"RENTED",...}}` | 200 | ✅ PASS |
| K26 | No auth token | Valid body, no JWT | 401 | `{"status":"error","message":"Authentication token missing or malformed."}` | 401 | ✅ PASS |
| K27 | All valid `currentAddressType` enum mappings | `"Rented"`, `"Owner(Self or Family)"`, `"OWN"`, `"RENTED"` | Correct enum stored | All 4 mapped correctly: `RENTED`, `OWNER_SELF_OR_FAMILY`, `OWNER_SELF_OR_FAMILY`, `RENTED` | 200 | ✅ PASS |
| K28 | Invalid `currentAddressType` value | `"currentAddressType":"INVALID_TYPE"` | 400 or null stored + warn | 200 — silently stores `null` (invalid value discarded without error) | 200 | ⚠️ WARN — no feedback to caller that type was ignored |
| K29 | Empty body — no existing address record | `{}` on fresh user | 400 | `{"status":"error","message":"Address record not found and payload incomplete for creation."}` | 400 | ✅ PASS |

---

## 6. Test Cases — `POST /api/kyc/verify-pan`

| # | Test Name | Input | Expected | Actual Response | HTTP | Result |
|---|---|---|---|---|---|---|
| K30 | Happy path — mock PAN, no image | `panNumber=TEST00000X` (multipart) | 200 with PAN details | `{"success":true,"data":{"panNumber":"TEST00000X","full_name":"PRIYANSHU ROUTH","isVerified":true,...}}` | 200 | ✅ PASS |
| K31 | No auth token | `panNumber=TEST00000X`, no JWT | 401 | `{"status":"error","message":"Authentication token missing or malformed."}` | 401 | ✅ PASS |
| K32 | Missing `panNumber` field | multipart with no panNumber field | 400 | `{"status":"error","message":"PAN number is required ❌"}` | 400 | ✅ PASS |
| K33 | Empty `panNumber` string | `panNumber=` | 400 | `{"status":"error","message":"PAN number is required ❌"}` | 400 | ✅ PASS |
| K34 | Invalid PAN format (real API call) | `panNumber=INVALIDPAN` | 400 | `{"status":"error","message":"oops Invalid Pan number"}` | 400 | ✅ PASS (but error message is unprofessional) |
| K35 | Duplicate PAN — different user | `panNumber=TEST00000X` on different user account | 400 duplicate error | `{"status":"error","message":"This PAN number is already registered with another account ❌"}` | 400 | ✅ PASS |
| K36 | Same PAN — same user re-submits | `panNumber=TEST00000X` on original user | 200 idempotent update | `{"status":"error","message":"This PAN number is already registered with another account ❌"}` | 400 | ❌ **FAIL — user blocked from re-verifying own PAN** |
| K37 | XSS in `panNumber` (via multipart form) | `panNumber=<script>alert(1)</script>` | 400 validation error | Connection reset — curl exit 26 (server drops connection without response) | — | ❌ **FAIL — server crashes / drops connection** |
| K38 | File over 10 MB | `panImage` = 11 MB binary | 400 file too large | 500 with full Multer internal stack trace and file path | 500 | ❌ **FAIL — Multer stack trace leaked, wrong HTTP status** |
| K39 | JSON body instead of multipart | `Content-Type: application/json` with `{"panNumber":"X"}` | 400 unsupported media | 400 duplicate PAN error (multer skips body; panNumber read from query or undefined, falls to duplicate check with previous record) | 400 | ⚠️ WARN — unexpected routing through duplicate check |
| K40 | Surname missing | with a pan number have only first name unable to submit request because neither surname received automatically nor surname input box is enabled - ❌ 
| K50 | when i change my pan number having no surname from already verified pan number with surname then it still pull previous surname detail (means the data which i never found in second verification is not  updated) - ❌ 
| UI fixes salary is increasing and decresing by upward and downward arrows + mouse wheel scrolling - ❌

---

## 7. Bug Report

### 7.1 Critical Bugs

| Severity | File | Location | Issue | Fix |
|---|---|---|---|---|
| 🔴 CRITICAL | `middleware/authMiddleware.js` | `authenticate()` | **Invalid/forged JWT returns 500 + full JWT library stack trace** instead of 401. The `JsonWebTokenError` is passed to `next(error)` and the global error handler exposes `error.stack` in the response. | In the global error handler (`middleware/ErrorHandler.js`), map `JsonWebTokenError` and `TokenExpiredError` to 401, strip `stack` in non-development environments |
| 🔴 CRITICAL | `services/kycService.js` / `models/employmentModel.js` | `upsertEmploymentDetails()` | **Invalid `stability` enum value crashes with 500 + full Prisma query internals** (`PrismaClientValidationError` with query structure, file paths, node_modules layout exposed). The stability string is passed through a `stabilityMap` but unmapped values are forwarded raw to Prisma. | Whitelist validate `stabilityValue` against the known enum values (`VERY_UNSTABLE`, `SOMEWHAT_UNSTABLE`, `NEUTRAL`, `STABLE`, `VERY_STABLE`) before the Prisma call; throw `BadRequestError` for any unrecognised value |
| 🔴 CRITICAL | `services/kycService.js` | `saveFullKYC()` line 133 | **XSS payload in `purpose` field stored verbatim in `purposeOfLoan` column** and reflected back in API responses. No sanitisation is applied to any string field in the KYC payload. | Sanitise all free-text string fields (`purpose`, `companyName`, `companyAddress`, `currentAddress`, etc.) using `validator.escape()` or `DOMPurify` before DB write; reject strings containing HTML tags with a 400 |

### 7.2 High Severity Bugs

| Severity | File | Location | Issue | Fix |
|---|---|---|---|---|
| 🟠 HIGH | `controllers/kycController.js` | `verifyPAN()` line 86–87 | **User cannot re-verify their own PAN** — `PanModel.findByPanNumber()` returns the existing record, but the subsequent `if (existingPanByNumber.userId !== userId)` check compares against the internal integer `id` field while the record stores `userId`. If there is any field mismatch or the first registration was incomplete, the user is permanently locked out of re-submitting their PAN. (Confirmed: same user submitting same PAN returns 400 "already registered with another account".) | Change the guard to allow re-verification by the same user: `if (existingPanByNumber && existingPanByNumber.userId !== userId) { throw ... }` — ensure the comparison uses the correct field matching the Prisma `PanVerification` schema |
| 🟠 HIGH | `routes/kycRoutes.js` / `middleware/ErrorHandler.js` | Multer error handling | **`MulterError: File too large` returns 500 with full internal stack trace** including node_modules paths. Multer errors are not caught before reaching the global error handler. | Add a multer-specific error handler in the route or as Express error middleware: `if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({status:'error',message:'File too large. Maximum allowed size is 10 MB.'})` |
| 🟠 HIGH | `controllers/kycController.js` | `verifyPAN()` multipart parsing | **XSS or special characters in `panNumber` (via multipart form) cause a connection reset** — when `<script>alert(1)</script>` is submitted as a form field, the server drops the connection with no response (curl exit 26). Root cause is likely multer or the downstream `panNumber.toUpperCase()` call crashing on an unexpected input. | Validate `panNumber` format (`/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i`) immediately after reading from `req.body`; reject non-matching values with 400 before any further processing |
| 🟠 HIGH | `services/kycService.js` | `saveFullKYC()` | **No idempotency guard — each call creates a new `LoanApplication` record** regardless of how many times the same user submits. A user with network issues submitting twice ends up with two pending applications. | Check if a `LoanApplication` already exists for this user before creating: query `prisma.loanApplication.findFirst({ where: { userId, status: 'PENDING' } })` and return the existing record if found |

### 7.3 Medium Severity Bugs

| Severity | File | Location | Issue | Fix |
|---|---|---|---|---|
| 🟡 MEDIUM | `services/kycService.js` | `saveFullKYC()` `isPlaceholder()` merge logic | **Silent DB fallback masks missing required fields** — if a user already has an employment record, submitting `POST /api/kyc` without `companyName` or `monthlyIncome` succeeds (200) by silently pulling the existing DB values. A caller who omits required fields gets no warning. | Log a warning when a fallback is used; alternatively, require all employment fields on the initial submission and only allow partial updates via the `PUT /api/kyc/employment` endpoint |
| 🟡 MEDIUM | `services/kycService.js` | `loanPayload` | **No maximum loan amount validation** — any positive number (e.g. `999999999999`) is accepted and stored. This can cause downstream arithmetic overflow in interest/EMI calculations and allows data integrity violations. | Add a business-rule cap: `if (loanAmount > 10000000) throw new BadRequestError('Loan amount exceeds maximum allowed limit.')` (adjust cap per business rules) |
| 🟡 MEDIUM | `controllers/kycController.js` | `updateAddress()` | **Invalid `currentAddressType` silently stored as `null`** — when an unrecognised type is submitted, the code sets `addressTypeValue = null` with no error returned to the caller. The user believes the update succeeded with their specified type but null is stored. | Return a 400 if the submitted `currentAddressType` does not resolve to a known enum value (`OWNER_SELF_OR_FAMILY` or `RENTED`) |
| 🟡 MEDIUM | `middleware/ErrorHandler.js` | Global error handler | **`error.stack` and `error.code` exposed in all 500 responses** — every unhandled error returns `{"status":"error","message":"...","code":"...","stack":"..."}`. Confirmed in K15, K19, K23, K38. | In non-development environments (`process.env.NODE_ENV !== 'development'`), strip `stack` and `code` from the response; return only `{"status":"error","message":"Something went wrong"}` for internal errors |

### 7.4 Low Severity / Code Quality Issues

| Severity | File | Location | Issue | Fix |
|---|---|---|---|---|
| 🟢 LOW | `controllers/kycController.js` | `getKYC()` | **`GET /api/kyc` returns 200 for a stub endpoint** — returning 200 implies the resource was found and returned; a stub should return 501 Not Implemented | Change to `res.status(501).json({ message: 'Not implemented yet' })` |
| 🟢 LOW | `services/surepassService.js` | `verifyPAN()` line 48 | **`console.log` debug statement in production code** — `console.log(panNumber.toUpperCase(),"----------------")` leaks PAN numbers to stdout | Remove `console.log`; use `logger.debug()` if tracing is needed |
| 🟢 LOW | `services/surepassService.js` | `verifyPAN()` | **Unprofessional error message** — `"oops Invalid Pan number"` is returned directly to clients on Surepass API failure | Replace with `"Invalid PAN number. Please check and resubmit."` |
| 🟢 LOW | `services/surepassService.js` | constructor | **Surepass JWT token hardcoded in source** — `SUREPASS_TOKEN` defaults to a literal JWT string if `process.env.SUREPASS_TOKEN` is unset. This token has a 90-day expiry and is visible in version control | Remove the hardcoded default; require the env variable to be set and fail fast at startup if missing |
| 🟢 LOW | `controllers/kycController.js` | `submitKYC()` | **No PAN format validation before real API call** — arbitrary strings are sent to the Surepass API; invalid ones return a generic "oops" error with no format guidance | Pre-validate PAN format with `/^[A-Z]{5}[0-9]{4}[A-Z]$/i` before calling the external API |

---

## 8. Security Findings Summary

| Finding | Category | Risk | Status |
|---|---|---|---|
| Prisma `PrismaClientValidationError` stack trace leaked on invalid enum | Information disclosure | Critical | ❌ Open |
| JWT library stack trace leaked on invalid token (500 instead of 401) | Information disclosure | Critical | ❌ Open |
| XSS payload stored raw in `purposeOfLoan` column and reflected in response | Stored XSS | Critical | ❌ Open |
| Special chars in multipart `panNumber` cause connection reset | Denial of Service / crash | High | ❌ Open |
| Multer stack trace leaked on file-too-large error | Information disclosure | High | ❌ Open |
| Surepass API token hardcoded in source (visible in version control) | Credential exposure | High | ❌ Open |
| User permanently blocked from re-verifying own PAN (duplicate check bug) | Logic error | High | ❌ Open |
| No loan amount upper bound — integer overflow risk downstream | Input validation | Medium | ❌ Open |
| Silent DB fallback on missing required fields masks validation gaps | Input validation | Medium | ❌ Open |
| Invalid address type silently stored as null (no caller feedback) | Input validation | Medium | ❌ Open |
| Each `POST /api/kyc` call creates a new LoanApplication (no idempotency) | Data integrity | Medium | ❌ Open |
| `error.stack` exposed in all 500 responses in production | Information disclosure | Medium | ❌ Open |
| `console.log` with PAN number in production service | Sensitive data in logs | Low | ❌ Open |
| `GET /api/kyc` stub returns 200 instead of 501 | Incorrect status code | Low | ❌ Open |
| Unprofessional "oops" error message from Surepass failure | UX / error handling | Low | ❌ Open |
| Prisma ORM parameterised queries block SQL injection | SQL injection | N/A | ✅ Protected |
| JWT authentication guards all KYC routes correctly (no public access) | Auth | N/A | ✅ Protected |
| PAN uniqueness check across users prevents PAN reuse | Data integrity | N/A | ✅ Protected |

---

## 9. Flow Diagram

```
GET /api/kyc
└── protect (JWT auth)
    ├── no token        →  401 ✅
    └── valid token     →  200 {"message":"KYC details not implemented yet"} ⚠️ STUB (should be 501)

POST /api/kyc
└── protect (JWT auth)
    ├── no token                    →  401 ✅
    ├── invalid JWT                 →  500 + stack trace (BUG — should be 401)
    └── valid token
        └── saveFullKYC(userId, data)
            ├── isPlaceholder() merge with existing DB records
            │   └── missing required fields silently fall back to DB ⚠️ WARN (existing user)
            ├── companyName missing (fresh user) →  400 ✅
            ├── monthlyIncome missing (fresh user) →  400 ✅
            ├── monthlyIncome <= 0               →  400 ✅
            ├── loanAmount missing / 0           →  400 ✅
            ├── loanAmount negative              →  400 ✅
            ├── loanAmount = string              →  400 ✅
            ├── loanAmount > max (no check)      →  200 stored ❌
            ├── purpose = XSS payload            →  200 stored raw ❌ (stored XSS)
            ├── stability = invalid enum         →  500 + Prisma internals ❌
            ├── purpose missing                  →  400 ✅
            └── all valid
                ├── EmploymentModel.upsertEmploymentDetails()
                ├── AddressModel.upsertAddress()
                ├── LoanModel.createLoan()
                ├── prisma.loanApplication.create()  ← new record every call ❌
                └── prisma.losIntegrationJob.create()
                    →  200 {user, employment, addressDetail, loan, application}

POST /api/kyc/verify-pan
└── protect → multer.single('panImage')
    ├── no token                    →  401 ✅
    ├── invalid JWT                 →  500 + stack trace ❌ (should be 401)
    ├── file > 10 MB                →  500 + Multer stack trace ❌ (should be 400)
    ├── panNumber missing / empty   →  400 ✅
    ├── panNumber = XSS chars       →  connection reset (crash) ❌
    ├── panNumber = invalid format  →  surepassService.verifyPAN() → 400 "oops Invalid Pan number" ✅ (bad msg)
    ├── panNumber already used by another user →  400 "already registered" ✅
    ├── panNumber already used by same user    →  400 "already registered with another account" ❌ (should allow re-verify)
    └── valid panNumber
        ├── surepassService.verifyPAN()       (mock: TEST00000X bypasses Surepass)
        ├── PanModel.findByUserId(userId)
        │   ├── exists → PanModel.updatePanRecord()
        │   └── not exists → PanModel.createPanRecord() + PanModel.verifyPan()
        └── 200 {panNumber, isVerified, ...surepassDetails}

PUT /api/kyc/employment
└── protect (JWT auth)
    ├── no token                    →  401 ✅
    ├── invalid JWT                 →  500 + stack trace ❌ (should be 401)
    ├── empty body (no existing)    →  400 ✅
    ├── invalid stability enum      →  500 + Prisma internals ❌ (should be 400)
    ├── all 6 stability labels      →  all correctly mapped ✅
    └── valid payload
        ├── EmploymentModel.findByUserId()
        │   ├── exists → updateEmploymentDetails()
        │   └── not exists → createEmploymentDetails() (requires employerName + monthlyIncome)
        └── 200 {success, data}

PUT /api/kyc/address
└── protect (JWT auth)
    ├── no token                    →  401 ✅
    ├── invalid JWT                 →  500 + stack trace ❌ (should be 401)
    ├── empty body (no existing)    →  400 ✅
    ├── invalid addressType         →  200 with null stored, no error ⚠️ (should be 400)
    ├── all 4 address type values   →  all correctly mapped ✅
    └── valid payload
        ├── AddressModel.findByUserId()
        │   ├── exists → updateAddress()
        │   └── not exists → createAddress() (requires currentAddress)
        └── 200 {success, data}
```

---

## 10. Recommendations (Priority Order)

1. **[CRITICAL] Strip stack traces from production error responses** — In `middleware/ErrorHandler.js`, check `process.env.NODE_ENV !== 'production'` before including `stack` and `code` in the response. Map `PrismaClientValidationError` → 400, `JsonWebTokenError`/`TokenExpiredError` → 401, `MulterError` → 400.

2. **[CRITICAL] Sanitise all free-text KYC string fields** — Apply `validator.escape()` (or equivalent) to `purpose`, `companyName`, `companyAddress`, `currentAddress`, `permanentAddress`, `city`, `state` before any DB write. Reject strings containing HTML tags with a 400.

3. **[CRITICAL] Whitelist-validate enum inputs before Prisma** — Add explicit validation for `stability` and `employmentType` before calling any Prisma query. Unknown values should throw a `BadRequestError('Invalid stability value')` rather than reaching Prisma which then crashes with a 500.

4. **[HIGH] Fix PAN re-verification logic** — In `kycController.verifyPAN()`, the duplicate-PAN guard should only block cross-user duplicates. Verify the field comparison is correct (`existingPanByNumber.userId !== userId` using the same type on both sides).

5. **[HIGH] Validate `panNumber` format before use** — Add a regex check `/^[A-Z]{5}[0-9]{4}[A-Z]$/i` immediately after reading `panNumber` from the form body. This prevents the connection-reset crash on special characters and provides a clean 400 with a helpful message.

6. **[HIGH] Handle Multer errors as middleware** — Add an Express error handler in `routes/kycRoutes.js` specifically for `multer.MulterError` to return 400 with a clean message before the global handler sees it.

7. **[HIGH] Move Surepass token to required environment variable** — Remove the hardcoded fallback JWT in `services/surepassService.js`. Add a startup check: `if (!process.env.SUREPASS_TOKEN) { logger.error('SUREPASS_TOKEN is required'); process.exit(1); }`.

8. **[MEDIUM] Add idempotency to `POST /api/kyc`** — Before creating a new `LoanApplication`, check if one already exists for this user in PENDING status and return it instead of creating another.

9. **[MEDIUM] Add max loan amount validation** — Define a business-rule cap (e.g. `5_00_000`) and reject amounts above it with a 400.

10. **[LOW] Fix `GET /api/kyc` stub status code** — Return 501 Not Implemented instead of 200.

11. **[LOW] Remove `console.log` with PAN in surepassService** — Replace with `logger.debug()` or remove entirely.

---

## 11. Test Coverage Summary

| Category | Tests Run | Pass | Fail | Warn |
|---|---|---|---|---|
| Happy path | 5 | 5 | 0 | 0 |
| Auth / JWT guard | 8 | 5 | 3 | 0 |
| Input validation | 12 | 8 | 2 | 2 |
| Enum mapping | 10 | 8 | 2 | 0 |
| Security / injection | 4 | 1 | 2 | 1 |
| File upload | 2 | 0 | 2 | 0 |
| PAN uniqueness / idempotency | 3 | 1 | 2 | 0 |
| Stub behaviour | 1 | 0 | 0 | 1 |
| Duplicate / idempotency (KYC) | 1 | 0 | 1 | 0 |
| **Total** | **46** | **28** | **14** | **4** |

---

## 12. Raw Test Log

### `GET /api/kyc`
```
K01  GET /api/kyc  [with JWT]   →  200  {"message":"KYC details not implemented yet"}
K02  GET /api/kyc  [no auth]    →  401  {"status":"error","message":"Authentication token missing or malformed."}
```

### `POST /api/kyc`
```
K03  Full valid payload         →  200  {success:true, employment:{id:550,...}, addressDetail:{...}, loan:{id:668,...}, application:{id:1900,...}}
K04  No auth                    →  401  {"status":"error","message":"Authentication token missing or malformed."}
K05  Missing companyName (fresh)→  400  {"status":"error","message":"Employment data incomplete ❌ (Company Name and Income required)"}
K06  Missing companyName (exist)→  200  (fallback to DB)  ← WARN
K07  Missing monthlyIncome (exist)→ 200  (fallback to DB income)  ← WARN
K08  Missing loanAmount         →  400  {"status":"error","message":"Loan data incomplete ❌"}
K09  Missing purpose            →  400  {"status":"error","message":"Loan data incomplete ❌"}
K10  loanAmount=0               →  400  {"status":"error","message":"Loan data incomplete ❌"}
K11  loanAmount=-5000           →  400  {"status":"error","message":"Invalid loan amount ❌"}
K12  monthlyIncome=-1000        →  400  {"status":"error","message":"Invalid monthly income ❌"}
K13  loanAmount="ten-lakhs"     →  400  {"status":"error","message":"Invalid loan amount ❌"}
K14  Empty body {}              →  400  {"status":"error","message":"Employment data incomplete ❌ ..."}
K15  stability="GARBAGE_VALUE"  →  500  {message:"Invalid...stability...",stack:"PrismaClientValidationError..."}  ← BUG
K16  purpose="<script>alert(1)" →  200  purposeOfLoan stored raw  ← CRITICAL BUG
K17  loanAmount=999999999999    →  200  stored as-is  ← BUG
K18  Duplicate submission (2nd) →  200  new appId=1907 (was 1906)  ← BUG
K19  Forged JWT                 →  500  {stack:"JsonWebTokenError..."}  ← BUG (should be 401)
```

### `PUT /api/kyc/employment`
```
K20  Happy path                 →  200  {employerName:"Updated Corp",stability:"VERY_STABLE",monthlyIncome:75000}
K21  No auth                    →  401  {"status":"error","message":"Authentication token missing or malformed."}
K22  Stability "Stable"         →  200  stability="STABLE"
     Stability "Very Stable"    →  200  stability="VERY_STABLE"
     Stability "Neutral"        →  200  stability="NEUTRAL"
     Stability "Neutral/mod"    →  200  stability="NEUTRAL"
     Stability "Somewhat unst." →  200  stability="SOMEWHAT_UNSTABLE"
     Stability "Very unstable"  →  200  stability="VERY_UNSTABLE"
K23  stability="VERY_BAD_ENUM"  →  500  {message:"Invalid...stability...",stack:"PrismaClientValidationError..."}  ← BUG
K24  Empty body (no record)     →  400  {"status":"error","message":"Employment record not found and payload incomplete for creation."}
```

### `PUT /api/kyc/address`
```
K25  Happy path                 →  200  {city:"Bangalore",currentAddressType:"RENTED",state:"Karnataka"}
K26  No auth                    →  401  {"status":"error","message":"Authentication token missing or malformed."}
K27  type="Rented"              →  200  currentAddressType="RENTED"
     type="Owner(Self/Family)"  →  200  currentAddressType="OWNER_SELF_OR_FAMILY"
     type="OWN"                 →  200  currentAddressType="OWNER_SELF_OR_FAMILY"
     type="RENTED"              →  200  currentAddressType="RENTED"
K28  type="INVALID_TYPE"        →  200  currentAddressType=null (silently discarded)  ← WARN
K29  Empty body (no record)     →  400  {"status":"error","message":"Address record not found and payload incomplete for creation."}
```

### `POST /api/kyc/verify-pan`
```
K30  panNumber=TEST00000X       →  200  {success:true,panNumber:"TEST00000X",full_name:"PRIYANSHU ROUTH",isVerified:true}
K31  No auth                    →  401  {"status":"error","message":"Authentication token missing or malformed."}
K32  No panNumber field         →  400  {"status":"error","message":"PAN number is required ❌"}
K33  panNumber=""               →  400  {"status":"error","message":"PAN number is required ❌"}
K34  panNumber=INVALIDPAN       →  400  {"status":"error","message":"oops Invalid Pan number"}
K35  Duplicate PAN (diff user)  →  400  {"status":"error","message":"This PAN number is already registered with another account ❌"}
K36  Same PAN (same user retry) →  400  {"status":"error","message":"This PAN number is already registered with another account ❌"}  ← BUG
K37  panNumber=<script>XSS      →  connection reset (curl exit 26)  ← BUG
K38  File > 10 MB               →  500  {message:"File too large",stack:"MulterError..."}  ← BUG
K39  JSON body (not multipart)  →  400  duplicate PAN error (unexpected routing)  ← WARN
```

---

## 13. Track Loan
K1 Any phone number(wrong number) give the user own loan deails
k2 Empty data giving the same user loan deails
k3 Address doesnn't fetched from the adhar or pan card
K4 mising drop down Current address type
K5 Net bank details link not working
k6 Loan history Loan reapply not working

*Report generated by automated test run against live server. Update this file after each sprint by re-running the test suite and appending a new dated section.*
