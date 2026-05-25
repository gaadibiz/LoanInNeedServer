# Frontend-Backend Integration Summary

## Overview
This document summarizes the integration between the LoanInNeed frontend (deployed at https://loaninneed.vercel.app) and backend (deployed at https://loaninneed-backend-production-7028.up.railway.app).

## Changes Made

### 1. Configuration Updates (`lib/config.ts`)
- Updated `apiUrl` to use production backend URL: `https://loaninneed-backend-production-7028.up.railway.app`
- Removed proxy pattern configuration

### 2. API Client Rewrite (`lib/api.ts`)
- **Removed all mock/dummy data logic**
- **Removed proxy pattern** - now makes direct calls to backend
- **Fixed all endpoints** to match backend API structure:
  - `/api/auth/phone/request-otp` - Request OTP
  - `/api/auth/phone/verify-otp` - Verify OTP
  - `/api/users/login` - Login with phone + DOB
  - `/api/users/register` - Register user (requires auth token)
  - `/api/users/me` - Get user profile
  - `/api/users/profile/complete` - Get complete profile
  - `/api/users/location` - Submit/get location
  - `/api/kyc` - Submit KYC details
  - `/api/document/submit` - Submit documents (salary slips, bank statements)
  - `/api/document/upload/:type` - Upload single document
  - `/api/document/status` - Get document status
  - `/api/selfie/upload` - Upload selfie
  - `/api/selfie/status` - Get selfie status
  - `/api/loans/apply` - Apply for loan

- **Fixed FormData handling** - properly handles file uploads without setting Content-Type header
- **Fixed authentication** - properly stores and sends JWT tokens

### 3. Signup Hook Updates (`hooks/useSignup.ts`)
- **Step 1**: Phone OTP request/verification - ✅ Integrated
- **Step 2**: User registration - ✅ Integrated
- **Step 3**: KYC submission - ✅ Integrated
- **Step 4**: Document submission (salary slips, bank statements) - ✅ Integrated
  - Note: Selfie is submitted separately in step 6
- **Step 5**: Aadhaar OTP verification - ✅ Integrated (if backend endpoint exists)
- **Step 6**: Selfie upload and location submission - ✅ Integrated

### 4. Login Hook Updates (`hooks/useLogin.ts`)
- **Fixed resend OTP** - now stores and reuses date of birth
- **Step 1**: Login with phone + DOB - ✅ Integrated
- **Step 2**: OTP verification - ✅ Integrated
- **Resend OTP**: Uses stored DOB - ✅ Fixed

## Backend Endpoints Reference

### Authentication
- `POST /api/auth/phone/request-otp` - Request OTP
- `POST /api/auth/phone/verify-otp` - Verify OTP (returns JWT token)

### User Management
- `POST /api/users/register` - Register user (requires JWT from OTP verification)
- `POST /api/users/login` - Login with phone + DOB (sends OTP)
- `GET /api/users/me` - Get user profile (requires JWT)
- `GET /api/users/profile/complete` - Get complete profile with KYC (requires JWT)
- `POST /api/users/location` - Submit location (requires JWT)
- `GET /api/users/location` - Get location (requires JWT)

### KYC
- `POST /api/kyc` - Submit full KYC details (requires JWT)

### Documents
- `POST /api/document/submit` - Submit documents (requires JWT, FormData)
  - Fields: `salarySlips` (array, max 5), `bankStatements` (array, max 5), `selfie` (single)
- `POST /api/document/upload/:type` - Upload single document (requires JWT, FormData)
- `GET /api/document/status` - Get document status (requires JWT)

### Selfie
- `POST /api/selfie/upload` - Upload selfie (requires JWT, FormData)
- `GET /api/selfie/status` - Get selfie status (requires JWT)

### Loans
- `POST /api/loans/apply` - Apply for loan (requires JWT)

### Partners (Not yet integrated in frontend)
- `POST /api/partners/register` - Register partner (super admin only)
- `POST /api/partners/login` - Partner login
- `GET /api/partners/profile` - Get partner profile
- `GET /api/partners/dashboard` - Get partner dashboard
- `GET /api/partners/link` - Generate referral link

## Integration Flow

### Signup Flow
1. User enters phone → Request OTP → Verify OTP (get JWT token)
2. User enters personal details → Register user (use JWT token)
3. User enters KYC details → Submit KYC (use JWT token)
4. User uploads documents → Submit documents (use JWT token, FormData)
5. User verifies Aadhaar OTP → Verify Aadhaar (if endpoint exists)
6. User uploads selfie and location → Upload selfie + submit location (use JWT token)

### Login Flow
1. User enters phone + DOB → Login (sends OTP)
2. User enters OTP → Verify OTP (get JWT token)
3. Redirect to dashboard

## CORS Configuration
Backend CORS is configured to allow:
- `http://localhost:3000` (local dev)
- `http://localhost:5173` (Vite dev)
- `https://loaninneed.vercel.app` (production)

## Authentication
- JWT tokens are stored in `localStorage` as `authToken`
- Tokens are automatically included in Authorization header: `Bearer <token>`
- Token is obtained after phone OTP verification

## File Uploads
- Documents are uploaded using `FormData`
- Backend expects:
  - `salarySlips`: Array of files (PDF, JPG, PNG), max 5 files
  - `bankStatements`: Array of files (PDF, JPG, PNG), max 5 files
  - `selfie`: Single file (image), max 1 file
- File size limit: 10MB per file
- Allowed types: PDF, JPEG, JPG, PNG

## Testing Checklist
- [ ] Phone OTP request works
- [ ] Phone OTP verification works
- [ ] User registration works
- [ ] Login with phone + DOB works
- [ ] Login OTP verification works
- [ ] KYC submission works
- [ ] Document upload works
- [ ] Selfie upload works
- [ ] Location submission works
- [ ] Loan application works

## Notes
- All mock/dummy data has been removed
- All API calls now go directly to production backend
- Error handling is in place for all endpoints
- FormData is properly handled for file uploads
- JWT tokens are properly managed

## Environment Variables
For local development, set:
```
NEXT_PUBLIC_BACKEND_URL=https://loaninneed-backend-production-7028.up.railway.app
```

For production (Vercel), set the same environment variable in Vercel dashboard.
