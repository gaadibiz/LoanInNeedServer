# LoanInNeed - API Endpoints and Frontend Routes

## 1. Backend API Endpoints (Express.js)

### Users (`/api/users`)

- `POST /api/users/register` - Register new user
  - **Request Body**: `{ attribution: { partnerId, timestamp, signature }, ...user_details }`
  - **Response Body**: `{ message: 'Registration completed successfully.', user: { ... } }`

- `PUT /api/users/profile` - Update profile
  - **Request Body**: `{ attribution: { partnerId, timestamp, signature }, ...user_details }`
  - **Response Body**: `{ message: 'Registration completed successfully.', user: { ... } }`

- `POST /api/users/login` - User login
  - **Request Body**: `{ phone, dob }`
  - **Response Body**: `{ message: 'OTP sent for login. Please verify to continue.', phone }`

- `POST /api/users/admin-login` - Admin login
  - **Request Body**: `{ email, password }`
  - **Response Body**: `{ token, admin: { ... } }` (Depends on service implementation)

- `GET /api/users/me` - Get current user profile
  - **Request Body**: None
  - **Response Body**: `{ message: 'Profile fetched successfully.', user: { ... } }`

- `GET /api/users/profile/complete` - Get complete profile
  - **Request Body**: None
  - **Response Body**: `{ message: 'Complete profile fetched successfully.', profile: { ... } }`

- `GET /api/users/dashboard` - Get user dashboard (Alias to `/profile/complete`)
  - **Request Body**: None
  - **Response Body**: `{ message: 'Complete profile fetched successfully.', profile: { ... } }`

- `POST /api/users/location` - Submit user location
  - **Request Body**: `{ latitude, longitude, address, ... }`
  - **Response Body**: `{ message: 'Location saved successfully', location: { ... } }`

- `GET /api/users/location` - Get user location
  - **Request Body**: None
  - **Response Body**: `{ location: { ... } }` (or `404` with `{ message: 'No location found' }`)


### Authentication (`/api/auth`)

- `POST /api/auth/phone/request-otp` - Request OTP via phone
  - **Request Body**: `{ phone }`
  - **Response Body**: JSON from Auth Service (e.g. `{ success: true, message: 'OTP sent' }`)

- `POST /api/auth/phone/verify-otp` - Verify OTP via phone
  - **Request Body**: `{ phone, code }`
  - **Response Body**: JSON from Auth Service (e.g. `{ success: true, token, user }`)

- `POST /api/auth/aadhaar/request-otp` - Request Aadhaar OTP
  - **Request Body**: `{ }` *(Empty)*
  - **Response Body**: `{ success: true, message: "OTP sent successfully" }`

- `POST /api/auth/aadhaar/verify-otp` - Verify Aadhaar OTP
  - **Request Body**: `{ otp }`
  - **Response Body**: `{ success: true, message: "Aadhaar verified successfully" }`


### KYC (`/api/kyc`)

- `POST /api/kyc/` - Submit KYC details
  - **Request Body**: Complete KYC JSON data
  - **Response Body**: `{ success: true, message: 'Full KYC details saved successfully ✔️', data: { ... } }`

- `GET /api/kyc/` - Get existing KYC details
  - **Request Body**: None
  - **Response Body**: `{ message: "KYC details not implemented yet" }`

- `POST /api/kyc/verify-pan` - Verify PAN details
  - **Request Body** (FormData): `panNumber` (text), `panImage` (file)
  - **Response Body**: `{ success: true, message: 'PAN verified successfully (Bypass) ✔️', data: { panNumber, isVerified: true } }`

- `PUT /api/kyc/employment` - Update employment info
  - **Request Body**: `{ employmentType, companyName, companyAddress, monthlyIncome, stability }`
  - **Response Body**: `{ success: true, message: 'Employment details updated', data: { ... } }`

- `PUT /api/kyc/address` - Update address info
  - **Request Body**: `{ currentAddress, permanentAddress, city/currentCity, state/currentState, postalCode/pinCode/currentPostalCode, currentAddressType }`
  - **Response Body**: `{ success: true, message: 'Address details updated', data: { ... } }`


### Document Verification (`/api/document`)

- `POST /api/document/submit` - Submit KYC Documents
  - **Request Body** (FormData): `salarySlips` (up to 5 files), `bankStatements` (up to 5 files), `selfie` (1 file)
  - **Response Body**: JSON result array/object containing S3 upload details. Or `500` with `{ message: 'Document upload failed' }`

- `POST /api/document/upload/:type` - Upload a single document by type (e.g., `AADHAAR`, `PAN`)
  - **Request Body** (FormData): `file`
  - **Response Body**: `{ message: '... uploaded successfully', document: { ... } }`

- `GET /api/document/status` - Get document verification status
  - **Request Body**: None
  - **Response Body**: JSON representing the status of document verification


### Selfie (`/api/selfie`)

- `POST /api/selfie/upload` - Upload selfie for identity verification
  - **Request Body** (FormData): `selfie` (file)
  - **Response Body**: JSON object with selfie upload results

- `GET /api/selfie/status` - Get selfie upload status
  - **Request Body**: None
  - **Response Body**: JSON status object


### Partners (`/api/partners`)

- `POST /api/partners/register` - Register new partner (SuperAdmin required)
  - **Request Body**: `{ name, email, phone, businessType, ... }`
  - **Response Body**: JSON with registered partner details

- `POST /api/partners/login` - Partner login
  - **Request Body**: `{ identifier, email, password }` (Supports both `identifier` or `email`)
  - **Response Body**: JSON with login token and partner details

- `GET /api/partners/dashboard` - Get partner dashboard details
  - **Request Body**: None
  - **Response Body**: JSON containing stats and dashboard numbers

- `GET /api/partners/earnings` - Get partner earnings
  - **Request Body**: None
  - **Response Body**: `{ success: true, message: 'Earnings fetched successfully', data: { ... } }`

- `GET /api/partners/link` - Generate referral link
  - **Request Body**: None
  - **Response Body**: JSON containing referral URL details


### Loans (`/api/loans`)

- `POST /api/loans/apply` - Apply for a new loan
  - **Request Body**: `{ loanAmount, purposeOfLoan, loanType }`
  - **Response Body**: `{ message: 'Loan application submitted successfully.', applicationId: '...', attribution: 'Partner ...' }`


---

## 2. Frontend Routes (Next.js Application)

*Note: The frontend uses the Next.js App Router (`app/` directory). Route Groups like `(auth)` or `(main)` are for organizational purposes and do not appear in the URL path.*

### Authentication & Identification
- `/login` - User login
- `/signup` - User sign-up
- `/login-agent` - Agent login
- `/register-agent` - Agent registration
- `/partners/login` - Partner login portal

### Application Dashboards
- `/dashboard` - Main User Dashboard
- `/affiliate-dashboard` - Affiliate/Partner Dashboard
- `/bc-dashboard` - Business Consultant Dashboard
- `/dsa-dashboard` - Direct Sales Agent Dashboard

### Main Pages & General Information
- `/` - Home Page
- `/about-us` - About Us
- `/contact-us` - Contact Us
- `/enquire-now` - General Inquiry Form
- `/apply-now` - General Application Form
- `/news` - News / Blog
- `/track-loan` - Loan Tracking
- `/personal-loan` - Personal Loan Info
- `/business-consultant` - Business Consultant Info
- `/direct-sales-agent` - Direct Sales Agent Info
- `/affiliate-program` - Affiliate Program Join Page

### Specialized Loan Segments
- `/personal-loan/insta-loan`
- `/personal-loan/40000-salary-loan`
- `/personal-loan/50000-salary-loan`
- `/personal-loan/80000-salary-loan`
- `/personal-loan/100000-salary-loan`

### Usecases (Purpose-driven loans)
- `/utility-bill-loan`
- `/medical-emergency-loan`
- `/house-rent-loan`
- `/education-purpose-loan`
- *(And other similar usecase routes)*

### Calculators & Tools
- `/loan-calculators/personal-emi-calculator`
- `/loan-calculators/loan-comparison-calculator`
- `/loan-calculators/eligibility-loan-calculator`
- `/loan-calculators/cibil-score-checker`

### Location-Based Landing Pages (SEO/Geo)
**Cities:**
- `/cities/payday-loan-in-pune`
- `/cities/payday-loan-in-mumbai`
- `/cities/payday-loan-in-kolkata`
- `/cities/payday-loan-in-hyderabad`
- `/cities/payday-loan-in-delhi`
- `/cities/payday-loan-in-chennai`
- `/cities/payday-loan-in-bengaluru`

**States:**
- `/states/payday-loan-in-west-bengal`
- `/states/payday-loan-in-punjab`
- `/states/payday-loan-in-orissa`
- `/states/payday-loan-in-madhya-pradesh`
- `/states/payday-loan-in-jharkhand`
- `/states/payday-loan-in-gujarat`
- `/states/payday-loan-in-chattisgarh`
- `/states/payday-loan-in-bihar`
- `/states/payday-loan-in-assam`

### Admin / Studio
- `/studio/[[...tool]]` - Content Management Studio (Sanity integration or similar)
