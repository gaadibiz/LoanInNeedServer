# API Endpoints, Routes, and Controllers Documentation

This document outlines all the active API routes registered on the Express backend, linking them to their respective router files and the specific controller functions they execute.

## Base Routes (from `server.js`)
All primary feature endpoints are prefixed with `/api` and delegated to separate router modules.

| Base Route | Router File |
|---|---|
| `/api/users` | `routes/userRoutes.js` |
| `/api/auth` | `routes/authRoutes.js` |
| `/api/kyc` | `routes/kycRoutes.js` |
| `/api/document` | `routes/documentVerificationRoutes.js` |
| `/api/selfie` | `routes/selfieRoutes.js` |
| `/api/partners` | `routes/partnerRoutes.js` |
| `/api/loans` | `routes/loanRoutes.js` |
| `/api/utils` | `routes/utilityRoutes.js` |

*(Note: Files like `analyticsRoutes.js`, `blogRoutes.js`, `cibilRoutes.js`, and `pageRoutes.js` currently exist in the `routes/` directory but are either empty or unused by `server.js`.)*

---

## 1. User Management (`/api/users`)
**Controller:** `controllers/userController.js`

| Method | Endpoint | Protection | Controller Function | Description |
|---|---|---|---|---|
| `POST` | `/register` | JWT | `registerUser` | Registers a new user |
| `PUT` | `/profile` | JWT | `registerUser` | Updates the existing user's profile |
| `POST` | `/login` | Public | `loginUser` | Initiates OTP-based customer login |
| `POST` | `/admin-login`| Public | `loginAdmin` | Admin specific login |
| `GET` | `/me` | JWT | `getProfile` | Retrieves the basic profile of the logged-in user |
| `GET` | `/profile/complete` | JWT | `getCompleteProfile` | Gets the complete user profile including KYC details |
| `GET` | `/dashboard` | JWT | `getCompleteProfile` | Alias to `/profile/complete` |
| `POST` | `/location` | JWT | `submitLocation` | Saves user's GPS/Location data |
| `GET` | `/location` | JWT | `getLocation` | Fetches saved GPS/Location data |

---

## 2. Authentication (`/api/auth`)
**Controller:** `controllers/authController.js`

| Method | Endpoint | Protection | Controller Function | Description |
|---|---|---|---|---|
| `POST` | `/phone/request-otp` | Public | `requestPhoneOtp` | Requests an OTP to the provided phone number |
| `POST` | `/phone/verify-otp` | Attribution | `verifyPhoneOtp` | Verifies phone OTP (runs attribution tracking) |
| `POST` | `/aadhaar/request-otp`| Public | `requestAadhaarOtp` | Requests Aadhaar verification OTP |
| `POST` | `/aadhaar/verify-otp` | Public | `verifyAadhaarOtp` | Verifies Aadhaar OTP |

---

## 3. KYC Processing (`/api/kyc`)
**Controller:** `controllers/kycController.js`

| Method | Endpoint | Protection | Controller Function | Description |
|---|---|---|---|---|
| `POST` | `/` | JWT | `submitKYC` | Submits complete basic KYC JSON |
| `GET` | `/` | JWT | `getKYC` | Retrieves current user KYC details |
| `POST` | `/verify-pan` | JWT, Upload | `verifyPAN` | Verifies PAN details alongside an image upload |
| `PUT` | `/employment` | JWT | `updateEmployment` | Updates specific user employment info |
| `PUT` | `/address` | JWT | `updateAddress` | Updates specific user address info |

---

## 4. Document Verification (`/api/document`)
**Controller:** `controllers/documentVerificationController.js`

| Method | Endpoint | Protection | Controller Function | Description |
|---|---|---|---|---|
| `POST` | `/submit` | JWT, Upload | `submitDocumentVerification` | Bulk multi-file upload for documents |
| `POST` | `/upload/:type` | JWT, Upload | `uploadDocument` | Single file upload dynamically tied to a type |
| `GET` | `/status` | JWT | `getVerificationStatus` | Gets overall verification completion status |

---

## 5. Selfie Verification (`/api/selfie`)
**Controller:** `controllers/selfieController.js`

| Method | Endpoint | Protection | Controller Function | Description |
|---|---|---|---|---|
| `POST` | `/upload` | JWT, Upload | `uploadSelfie` | Uploads a selfie for user identity match |
| `GET` | `/status` | JWT | `getSelfieStatus` | Retrieves the selfie verification status |

---

## 6. Partners (`/api/partners`)
**Controller:** `controllers/partnerController.js`

| Method | Endpoint | Protection | Controller Function | Description |
|---|---|---|---|---|
| `POST` | `/register` | JWT, SuperAdmin | `registerPartner` | Registers new partner |
| `POST` | `/login` | Public | `loginPartner` | Logs in a partner |
| `GET` | `/profile` | Partner JWT | `getPartnerProfile` | Gets specific partner profile details |
| `PUT/POST` | `/profile` | Partner JWT | `updatePartnerProfile`| Updates partner details |
| `PUT/POST` | `/password` | Partner JWT | `changePartnerPassword`| Changes partner access password |
| `GET` | `/dashboard` | Partner JWT | `getPartnerDashboard` | Retrieves partner analytics dashboard |
| `GET` | `/earnings` | Partner JWT | `getPartnerEarnings` | Retrieves partner earning ledger |
| `GET` | `/link` | Partner JWT | `generateReferralLink` | Provides dynamic referral link |

---

## 7. Loans (`/api/loans`)
**Controller:** `controllers/loanController.js`

| Method | Endpoint | Protection | Controller Function | Description |
|---|---|---|---|---|
| `POST` | `/apply` | JWT, Attribution | `applyForLoan` | Submits loan app and triggers the LOS process |

---

## 8. Utilities (`/api/utils`)
**Controller:** Line Implementation in `routes/utilityRoutes.js`

| Method | Endpoint | Protection | Controller Function | Description |
|---|---|---|---|---|
| `POST` | `/base64-encode`| Public | *(Inline via `base64Encoder.js`)* | Utility to convert uploaded file to Base64 |
