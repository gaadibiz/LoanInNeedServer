# Loan APIs Technical Documentation

This document provides a comprehensive technical reference for the Loan APIs available in the LoanInNeed backend application. It details the endpoints, expected request formats, authentication requirements, and sample responses.

---

## 1. Apply for a Loan
**Endpoint:** `POST /api/loans/apply`

**Description:** 
Submits a new loan application for the authenticated user. It automatically captures any attribution parameters via middleware and triggers a background job to push the application to the external Loan Origination System (LOS).

**Authentication:** Required (`Bearer Token` in Authorization header)

### Request Headers
| Header | Type | Required | Description |
| ---- | ---- | ---- | ---- |
| `Authorization` | string | Yes | Format: `Bearer <jwt_token>` |
| `Content-Type` | string | Yes | `application/json` |

### Request Body
| Field | Type | Required | Description |
| ---- | ---- | ---- | ---- |
| `loanAmount` | number | Yes | The requested loan amount (e.g., `50000`). |
| `purposeOfLoan` | string | Yes | Reason or description for the loan. |
| `loanType` | string | Optional | Enum value for the type of loan. Default is `'OTHER'`. Examples: `'MEDICAL_EMERGENCY'`, `'EDUCATION'`, `'WEDDING'`, `'TRAVEL'`. |

**Sample Request (JSON):**
```json
{
  "loanAmount": 50000,
  "purposeOfLoan": "Medical Emergency for family",
  "loanType": "MEDICAL_EMERGENCY"
}
```

### Response

**Success Response (201 Created):**
Returned when the application is successfully created in the local database and the LOS integration background job is queued.

**Sample Response Body:**
```json
{
  "message": "Loan application submitted successfully.",
  "applicationId": 105,
  "attribution": "Partner 12" 
}
```
*(Note: If no attribution partner exists, `"attribution": "Organic"` will be returned)*

**Error Responses:**
- **401 Unauthorized:** Missing or invalid Bearer token.
  ```json
  {
    "message": "Not authorized, token failed"
  }
  ```
- **400 Bad Request:** Missing required parameters or invalid data types.
  ```json
  {
    "message": "Validation Error: loanAmount is required"
  }
  ```

---

## Workflow Sequence Details
When `/api/loans/apply` is called, the backend follows this internal workflow:
1. **Attribution Check:** The system looks for active `partnerId` values locked to the user or passed within the current session to ensure proper affiliate/partner tracking (`attributionSource`).
2. **Database Persistence:** A new `LoanApplication` record is saved to the local database with status `PENDING`.
3. **LOS Queueing:** The system creates a `LosIntegrationJob` record. The `losWorker.js` cron job processes this in the background, transforming the data according to `losMapping.js` and securely POSTing it to the third-party LOS API.
4. **Activity Logging:** An `AttributionLog` interaction event is recorded referencing the partner (if applicable).

--- 

## *Future Endpoints (Planned API Stubs)*
*(Note: As the application expands, the following `GET` APIs are recommended to be added to `loanRoutes.js` to support client-side tracking functionality.)*

### 2. Get User Loans (Stub)
**Endpoint:** `GET /api/loans`
**Description:** Fetch all loan applications made by the authenticated user.
**Auth:** Required

### 3. Get Loan details by ID (Stub)
**Endpoint:** `GET /api/loans/:id`
**Description:** Get specific tracking details and LOS status of a single loan.
**Auth:** Required
