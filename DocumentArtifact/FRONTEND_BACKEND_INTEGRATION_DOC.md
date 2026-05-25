# LoanInNeed: Frontend and Backend Integration Architecture

## 1. System Overview and Tech Stack

The LoanInNeed application uses a decoupled microservices-like architecture over HTTPS:

*   **Backend Application (`\Backend`)**:
    *   **Framework**: Node.js with Express 5.x.
    *   **Database ORM**: Prisma ORM connecting to PostgreSQL.
    *   **Server Core**: Configured in `server.js` using `cors`, `helmet` (for security), and `morgan`/`winston` for robust logging. Focuses heavily on centralized error handling (`GlobalExceptionHandler/errorHandler`).
    *   **Cloud Integrations**: Uses Twilio (implicitly/via services) for OTPs, and external storage (Supabase/S3) via `multer` for document handling.
    *   **Background Jobs**: Implements a dedicated worker (`scripts/losWorker.js`) deployed alongside the main server for Loan Origination System (LOS) syncs.

*   **Frontend Application (`\LIN\lin-frontend`)**:
    *   **Framework**: Next.js 15 (App Router) with React 19.
    *   **Styling & UI**: Tailwind CSS v4, Radix UI components, Framer Motion for animations.
    *   **Form Management**: `@tanstack/react-form` combined with `react-hook-form` and `zod` for robust schema validation (e.g., `signup-schemas.ts`, `login-schemas.ts`, and Partner schemas).
    *   **API Management**: A custom singleton Class `ApiClient` (`lib/api.ts`) managing API calls, auth tokens, standard headers, and form-data uploads using native browser `fetch`.

## 2. Network & CORS Configuration

The Express backend specifically whitelists allowed origins via CORS to prevent unauthorized access:
*   `http://localhost:3000` (Next.js local development)
*   `http://localhost:5173` (Vite, legacy/tooling port)
*   `https://loaninneed.vercel.app` (Primary Production Frontend)
*   Dynamic wildcard for Vercel preview environments (`*.vercel.app`)

The frontend determines the backend target dynamically via `NEXT_PUBLIC_BACKEND_URL` environment variables.

## 3. Communication Layer: Custom `ApiClient`

The Next.js frontend uses a shared class `ApiClient` (`lib/api.ts`) rather than direct unstructured `fetch` calls. This ensures:
1.  **Token Interception**: Every request automatically injects the correct token. It dynamically senses if the request is a "User Payload" vs "Partner Payload" by checking `usePartnerToken` flags and injecting `localStorage.getItem('authToken')` vs `localStorage.getItem('partnerAuthToken')`.
2.  **FormData Handling**: If the payload is an instance of `FormData` (e.g., Image or PDF uploads), it intelligently skips setting the `Content-Type: application/json` header, allowing the browser to automatically set boundary data.
3.  **Attribution Passing**: Native methods check for marketing attribution data (`lin_attribution` containing `partnerId`, `timestamp`, `signature`) and append it to registration requests automatically.
4.  **Error Normalization**: Standardizes HTTP error codes and JSON error messages thrown by the Express `errorHandler`.

## 4. End-User Integration Workflows

### A. The 6-Step Signup Workflow (`hooks/useSignup.ts`)
The `useSignup` React hook maps local frontend state linearly to distinct backend REST processes:

1.  **Phone Verification**: 
    *   Frontend sends raw phone via `POST /api/auth/phone/request-otp`.
    *   User inputs OTP; frontend calls `POST /api/auth/phone/verify-otp`.
    *   **Result**: Backend issues a `token` (JWT). Frontend stores it via `apiClient.setToken()`.
2.  **Profile Registration**:
    *   Requires the JWT from Step 1.
    *   Frontend posts sanitized name, DOB, auto-generated email (e.g., `user919999999999@loaninneed.com`) to `POST /api/users/register`.
3.  **KYC Submission**:
    *   Frontend aggregates Job Stability, Address, and Loan Purpose.
    *   Calls `POST /api/kyc`.
4.  **Document Uploads**:
    *   Frontend asserts valid `File` objects exist.
    *   Constructs `FormData` appending `salarySlips` and `bankStatements`.
    *   Posts to `POST /api/document/submit` (Multipart boundaries automatically set).
5.  **Aadhaar Verification**:
    *   Target endpoint placeholder `POST /api/auth/aadhaar/verify-otp`.
6.  **Selfie & Geo-Location**:
    *   Frontend isolates the `File` blob to call `POST /api/selfie/upload`.
    *   Simultaneously parses latitude/longitude coordinates and posts to `POST /api/users/location`.

### B. Recurring User Login (`hooks/useLogin.ts`)
1.  **Initial Auth**: User submits Phone + DOB to `POST /api/users/login`. Backed checks validity and issues OTP.
2.  **OTP Validation**: Submits OTP to `/api/auth/phone/verify-otp`.
3.  **Dashboard Load**: With a renewed JWT, user hits `/dashboard` where the frontend invokes `GET /api/users/profile/complete` to seed the user application state.

## 5. Partner & Agent Integration Workflows

The system supports discrete logic for third-party business partners (DSA, BC, Affiliates). The API client partitions Partner sessions distinctly from End-User sessions.

### A. Partner Authentication
*   **Login Flow**: `loginPartner` uses `identifier` (Email or Phone) at `POST /api/partners/login`.
*   **OTP-based Login**: Alternative methods allow partner login via `POST /api/partners/login/request-otp` and verification.
*   **State Separation**: The backend generates a JWT which the frontend explicitly stores as `partnerAuthToken` and `partnerData`. This ensures an agent can be logged into their dashboard while helping a user register independently on the same machine.

### B. Partner Data and Action Endpoints
When an agent or partner navigates to their specific dashboard (`/affiliate-dashboard`, `/bc-dashboard`, `/dsa-dashboard`), the following API paths load their toolsets:
*   `GET /api/partners/profile`: Fetches their onboarding details (GST, PAN).
*   `GET /api/partners/dashboard`: Fetches high-level metrics (Total applications sourced, conversion metrics).
*   `GET /api/partners/earnings`: Specialized affiliate endpoint mapping directly to commissions.
*   `GET /api/partners/link`: Generates tracking URLs (containing `partnerId`) used for attribution in the standard User Signup Flow.

## 6. Unified Endpoint Registry

| Frontend Responsibility Strategy | End-User Express Bound Endpoint | Partner Express Bound Endpoint |
| :--- | :--- | :--- |
| **Authentication Strategy** | `POST /api/auth/phone/*` | `POST /api/partners/login` |
| **Initial Registration** | `POST /api/users/register` | `POST /api/partners/register` (Superadmin) |
| **Primary Dashboard UI Hydration** | `GET /api/users/profile/complete` | `GET /api/partners/dashboard` |
| **Multipart File Processing** | `POST /api/document/submit`, `POST /api/selfie/upload` | N/A |
| **Geography & Compliance** | `POST /api/users/location`, `POST /api/kyc` | N/A |
| **Goal Invocation** | `POST /api/loans/apply` | `GET /api/partners/link` |

## Summary
The integration is heavily reliant on a stateless, JWT-driven REST micro-architecture. The frontend Next.js application isolates complex payload construction (FormData manipulation, Attribution tracking, Token swapping between User and Partner) into `lib/api.ts` and React custom hooks, keeping the UI components declarative. The Node.js Express backend remains strictly focused on data validation, storage mapping, and orchestration across services (CIBIL, Databases, S3).
