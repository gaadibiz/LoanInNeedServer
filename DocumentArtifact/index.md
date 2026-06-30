# LoanInNeed Server — Project Index

> **Purpose of this file:** Quick-reference map for AI agents. Tells you which file owns which functionality so you can navigate directly to the right place when debugging or testing a specific feature.

---

## Stack at a Glance

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 18+, Express 5.x |
| ORM / DB | Prisma + PostgreSQL |
| Auth | JWT (HS256), bcryptjs |
| File Storage | Supabase (`Documents` bucket) |
| SMS / OTP | Custom SMS API (speqtrainnov.in) |
| Logging | Winston (daily-rotated files by level) |
| Tests | Jest (unit + integration + security + perf) |

**Entry point:** `server.js`

---

## Folder Map

```
LoanInNeedServer/
├── server.js                    ← Express app bootstrap, all route mounts, global error handler
├── package.json
├── jest.config.js
├── prisma/
│   └── schema.prisma            ← All DB models & enums (source of truth for data shape)
├── controllers/                 ← HTTP handlers (thin layer — delegates to services)
├── routes/                      ← Route definitions + middleware chains
├── middleware/                  ← Auth guards, file uploads, attribution validation
├── services/                    ← Business logic (all real work happens here)
├── models/                      ← Prisma DB access wrappers (one file per entity)
├── utils/                       ← JWT, hashing, crypto, SMS, logging helpers
├── GlobalExceptionHandler/      ← Custom error classes + global Express error middleware
├── config/                      ← Supabase client, DB config stubs
├── __tests__/                   ← All tests (unit / integration / security / performance)
├── scripts/                     ← One-off setup & verification scripts
├── uploads/temp/                ← Multer temporary disk storage (before Supabase upload)
└── logs/                        ← Winston output (error/ warn/ info/ http/ debug/ combined)
```

---

## Feature → File Mapping

### Authentication & OTP

| What you want to test/debug | Files to look at |
|-----------------------------|-----------------|
| Request SMS OTP | `routes/authRoutes.js` → `controllers/authController.js` → `services/authService.js` → `utils/smsOtpService.js` |
| Verify OTP + get JWT | same chain; `authService.verifyPhoneOtp()` creates user on first login |
| OTP DB record (store/expire) | `models/otpModel.js`, `utils/smsOtpService.js` |
| Master OTP bypass (`261102`) | `utils/smsOtpService.js` — hardcoded bypass for testing |
| JWT generation | `utils/jwt.js` — `generateToken()`, `verifyToken()` |
| JWT verification middleware | `middleware/authMiddleware.js` — `authenticate` / `protect` |
| Aadhaar OTP (stub/bypass) | `controllers/authController.js` → `services/aadharService.js` (stub only) |

---

### User Registration & Profile

| What you want to test/debug | Files to look at |
|-----------------------------|-----------------|
| Register user (name/DOB/gender) | `routes/userRoutes.js` → `controllers/userController.js` → `services/userServices.js` → `models/userModel.js` |
| Login via phone + DOB | `controllers/userController.js` → `services/userServices.js` `loginViaPhoneAndDob()` |
| Get profile (`GET /api/users/me`) | `controllers/userController.js` `getProfile()` → `services/userServices.js` |
| Get full KYC profile | `controllers/userController.js` `getCompleteProfile()` → `services/userServices.js` |
| Admin login | `controllers/userController.js` `loginAdmin()` |
| User DB model | `models/userModel.js` |
| Password hashing | `utils/hash.js` — `hashPassword()`, `comparePassword()` |
| Save / get geolocation | `controllers/userController.js` `submitLocation()` / `getLocation()` → `services/locationService.js` → `models/userLocationModel.js` |

---

### KYC

| What you want to test/debug | Files to look at |
|-----------------------------|-----------------|
| Submit full KYC (atomic) | `routes/kycRoutes.js` → `controllers/kycController.js` → `services/kycService.js` `saveFullKYC()` (Prisma transaction) |
| Update employment details | `controllers/kycController.js` `updateEmployment()` → `models/employmentModel.js` |
| Update address details | `controllers/kycController.js` `updateAddress()` → `models/adressModel.js` |
| PAN verification (submit) | `controllers/kycController.js` `verifyPAN()` → `models/panModel.js` (bypass — no real API call) |
| Employment DB model | `models/employmentModel.js` |
| Address DB model | `models/adressModel.js` |
| PAN DB model | `models/panModel.js` |
| Aadhaar DB model | `models/aadhaarModel.js` |
| KYC file upload middleware | `routes/kycRoutes.js` — multer `upload.single('panImage')` |

---

### Document Upload & Verification

| What you want to test/debug | Files to look at |
|-----------------------------|-----------------|
| Upload a document (single) | `routes/documentVerificationRoutes.js` → `controllers/documentVerificationController.js` → `services/documentService.js` `uploadDocument()` |
| Submit multiple documents | `controllers/documentVerificationController.js` `submitDocumentVerification()` → `services/documentService.js` `submitDocuments()` |
| Get document verification status | `controllers/documentVerificationController.js` `getVerificationStatus()` |
| Supabase file upload logic | `services/documentService.js` — uploads to `Documents/{DOCTYPE}/{userId}/` path |
| Document DB metadata | `models/documentModel.js`, `models/UserDocumentUploadModel.js` |
| Multer file type / size rules | `middleware/uploadMiddleware.js` — PDF, JPEG, PNG; 10 MB limit |

---

### Selfie

| What you want to test/debug | Files to look at |
|-----------------------------|-----------------|
| Upload selfie | `routes/selfieRoutes.js` → `controllers/selfieController.js` → `services/selfieService.js` `saveSelfie()` |
| Get selfie status | `controllers/selfieController.js` → `services/selfieService.js` `getSelfieStatus()` |
| Selfie Supabase storage | `services/selfieService.js` |

---

### Loan Application

| What you want to test/debug | Files to look at |
|-----------------------------|-----------------|
| Apply for a loan | `routes/loanRoutes.js` → `controllers/loanController.js` `applyForLoan()` |
| Loan attribution capture | `controllers/loanController.js` — reads `req.attribution` set by `attributionMiddleware` |
| Loan DB model | `models/loanApplicationModel.js` |

---

### Partner / DSA / Affiliate System

| What you want to test/debug | Files to look at |
|-----------------------------|-----------------|
| Register a partner | `routes/partnerRoutes.js` → `controllers/partnerController.js` → `services/partnerService.js` `registerPartner()` (Super Admin only) |
| Partner login | `controllers/partnerController.js` `loginPartner()` → `services/partnerService.js` |
| Generate referral link (HMAC-signed) | `services/partnerService.js` `generateReferralLink()` → `utils/cryptoUtils.js` |
| Partner JWT guard | `middleware/partnerAuthMiddleware.js` — `protectPartner` |
| Partner dashboard stats | `services/partnerService.js` `getPartnerDashboard()` |
| Partner earnings | `services/partnerService.js` `getPartnerEarnings()` |
| Partner DB model | (Prisma `Partner` model in `prisma/schema.prisma`) |

---

### Attribution / Referral Tracking

| What you want to test/debug | Files to look at |
|-----------------------------|-----------------|
| Validate referral link on request | `middleware/attributionMiddleware.js` — checks `?pid`, `?ts`, `?sig` via HMAC-SHA256 |
| First-touch attribution lock | `services/authService.js` `verifyPhoneOtp()` — calls attribution lock on user creation |
| Attribution DB log | `prisma/schema.prisma` → `AttributionLog` model |
| HMAC signature generation/verify | `utils/cryptoUtils.js` — `generateHmac()`, `compareHmac()` |
| Partner secret encryption | `utils/cryptoUtils.js` — `encrypt()` / `decrypt()` (AES-256-CBC) |

---

### Error Handling

| What you want to test/debug | Files to look at |
|-----------------------------|-----------------|
| Custom error classes | `GlobalExceptionHandler/exception.js` — `AppError`, `BadRequestError`, `NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`, `ValidationError`, `InternalServerError` |
| Global error middleware (Express) | `middleware/ErrorHandler.js` + mounted last in `server.js` |
| Throw a semantic error | Import from `GlobalExceptionHandler/exception.js`, `throw new BadRequestError('msg')` |

---

### Security Utilities

| What you want to test/debug | Files to look at |
|-----------------------------|-----------------|
| AES-256-CBC encrypt/decrypt | `utils/cryptoUtils.js` |
| HMAC-SHA256 sign/verify | `utils/cryptoUtils.js` |
| Password hash + compare | `utils/hash.js` |
| JWT sign + verify | `utils/jwt.js` |
| Input format validators | `utils/validator.js` — phone, email, PAN, Aadhaar |
| Helmet, CORS config | `server.js` — top of file |

---

### Logging

| What you want to test/debug | Files to look at |
|-----------------------------|-----------------|
| Logger instance (use anywhere) | `utils/logger.js` — `logger.info()`, `.error()`, `.warn()`, `.debug()` |
| Log file output | `logs/error/`, `logs/warn/`, `logs/info/`, `logs/http/`, `logs/debug/`, `logs/combined/` |
| HTTP request logging | `middleware/requestLogger.js` |

---

### Database Schema (Prisma)

| Entity | Prisma model name | Purpose |
|--------|------------------|---------|
| User | `User` | Core user record, phone-verified, attribution fields |
| Partner | `Partner` | DSA / BC / Affiliate accounts with HMAC secret |
| Loan Application | `LoanApplication` | Loan requests linked to user + attribution |
| OTP | `Otp` | SMS OTP records with 10-min expiry |
| Employment | `EmploymentDetail` | Job stability, employer, salary |
| Address | `AddressDetail` | Current/permanent address, type |
| PAN Verification | `PanVerification` | PAN document & status |
| Aadhaar Verification | `AadhaarVerification` | Aadhaar document & status |
| User Document | `UserDocument` | Uploaded file metadata (URL, mime, size, status) |
| Attribution Log | `AttributionLog` | Partner referral clicks, conversions, applications |
| User Location | `UserLocation` | Geolocation captures |
| Blog | `Blog` | CMS blog posts (stub) |
| Page | `Page` | CMS pages (stub) |
| CIBIL Score | `CibilScore` | CIBIL integration (stub) |

**Full schema file:** `prisma/schema.prisma`

---

## API Endpoint Quick Reference

```
AUTH
  POST  /api/auth/phone/request-otp          → Request SMS OTP
  POST  /api/auth/phone/verify-otp           → Verify OTP, get JWT, lock attribution
  POST  /api/auth/aadhaar/request-otp        → Stub
  POST  /api/auth/aadhaar/verify-otp         → Stub (bypass)

USER
  POST  /api/users/register                  → Register (requires JWT from OTP step)
  POST  /api/users/login                     → Login via phone + DOB
  GET   /api/users/me                        → Get own profile (JWT required)
  GET   /api/users/profile/complete          → Full KYC profile (JWT required)
  POST  /api/users/location                  → Save geolocation
  GET   /api/users/location                  → Get latest geolocation
  POST  /api/users/admin-login               → Admin login

KYC
  POST  /api/kyc                             → Submit full KYC (JWT required)
  POST  /api/kyc/verify-pan                  → Upload & verify PAN
  PUT   /api/kyc/employment                  → Update employment details
  PUT   /api/kyc/address                     → Update address details

DOCUMENTS
  POST  /api/document/submit                 → Upload multiple documents
  POST  /api/document/upload/:type           → Upload single document by type
  GET   /api/document/status                 → Document verification status

SELFIE
  POST  /api/selfie/upload                   → Upload selfie
  GET   /api/selfie/status                   → Selfie verification status

LOANS
  POST  /api/loans/apply                     → Apply for loan (JWT + attribution)

PARTNERS
  POST  /api/partners/register               → Register partner (Super Admin only)
  POST  /api/partners/login                  → Partner login
  GET   /api/partners/profile                → Partner profile (JWT required)
  PUT   /api/partners/profile                → Update partner profile
  PUT   /api/partners/password               → Change partner password
  GET   /api/partners/dashboard              → Dashboard stats
  GET   /api/partners/earnings               → Earnings breakdown
  GET   /api/partners/link                   → Generate HMAC referral link

STUBS (not yet implemented)
  /api/analytics
  /api/blogs
  /api/pages
  /api/cibil
```

---

## Middleware Chains

```
Public endpoints             → (none)
User-protected endpoints     → authenticate (authMiddleware.js)
Loan apply                   → protect → attributionMiddleware
Partner endpoints            → protectPartner (partnerAuthMiddleware.js)
Partner register             → protectPartner → superAdmin
File upload endpoints        → authenticate → upload.single() or upload.fields()
```

---

## Testing

| Test type | Location | Run command |
|-----------|----------|-------------|
| All tests | `__tests__/` | `npm test` |
| Auth OTP flow | `__tests__/integration/auth.phone.spec.js` | `npx jest auth.phone` |
| User CRUD | `__tests__/integration/user.basic.spec.js` | `npx jest user.basic` |
| KYC flow | `__tests__/integration/kyc.integration.spec.js` | `npx jest kyc` |
| Document upload | `__tests__/integration/document.integration.spec.js` | `npx jest document` |
| Selfie | `__tests__/integration/selfie.integration.spec.js` | `npx jest selfie` |
| Location | `__tests__/integration/location.integration.spec.js` | `npx jest location` |
| JWT unit | `__tests__/unit/jwt.spec.js` | `npx jest jwt` |
| Auth middleware | `__tests__/unit/middleware/authMiddleware.spec.js` | `npx jest authMiddleware` |
| Security | `__tests__/security/security.spec.js` | `npx jest security` |
| Performance | `__tests__/performance/performance.spec.js` | `npx jest performance` |
| Test helpers / factories | `__tests__/test-helpers/` | — |

**Master OTP for tests:** `261102` (bypasses real SMS in `utils/smsOtpService.js`)

---

## Key Environment Variables

| Variable | Used in |
|----------|---------|
| `DATABASE_URL` | `utils/prismaClient.js` |
| `JWT_SECRET` | `utils/jwt.js` |
| `JWT_EXPIRES_IN` | `utils/jwt.js` |
| `SMS_API_URL`, `SMS_API_KEY`, `SMS_SENDER_ID`, `SMS_ENTITY_ID`, `SMS_TEMPLATE_ID` | `utils/smsOtpService.js` |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | `config/supabase.js` |
| `ENCRYPTION_KEY` | `utils/cryptoUtils.js` (AES-256) |
| `HMAC_SECRET` | `utils/cryptoUtils.js` (partner referral links) |

---

## Stub / Not-Yet-Implemented Areas

These files exist but contain no real logic — don't waste time debugging them:

- `controllers/analyticsController.js`, `blogController.js`, `pageController.js`, `cibilController.js`
- `services/loanService.js`, `emailService.js`, `panService.js`, `aadharService.js`, `consentService.js`, `analyticsService.js`
- `config/db.js`, `config/config.js`
- `utils/aadhaarOtp.js`, `utils/twilioOtp.js`, `utils/crypto.js` (use `cryptoUtils.js` instead)
