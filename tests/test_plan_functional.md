# Functional Testing Plan

## Overview
This document lists the test cases to verify that the application meets all business requirements and functions as expected from an end-user perspective.

## Test Cases

### TC-FUNC-001: User Registration and Authentication
- **Description**: Test signing up with valid/invalid details, and logging in.
- **Expected Result**: Valid users are created and receive a JWT. Invalid inputs return proper 400 error codes.

### TC-FUNC-002: Loan Application Creation
- **Description**: Submit a complete loan application payload.
- **Expected Result**: Application is successfully recorded in the database and is assigned a unique tracking ID.

### TC-FUNC-003: Document Upload Functionality
- **Description**: Upload valid PDFs and invalid executables as supporting documents.
- **Expected Result**: PDFs are accepted and stored. Executables are rejected by the file filter.

### TC-FUNC-004: Data Validation on Bad Inputs
- **Description**: Send missing fields, incorrect data types, and out-of-bounds values to various endpoints.
- **Expected Result**: API strictly validates input via middleware (e.g., Joi/Zod) and returns descriptive validation errors.

### TC-FUNC-005: Role-Based Access Control (RBAC) Enforcement
- **Description**: A standard user attempts to access an admin-only endpoint.
- **Expected Result**: System returns a 403 Forbidden error.

### TC-FUNC-006: Password Reset Flow
- **Description**: Trigger password reset, use the token, and login with the new password.
- **Expected Result**: Password is updated securely, old password becomes invalid.

### TC-FUNC-007: Loan Status Updates
- **Description**: Change the status of a loan from 'Pending' to 'Approved'.
- **Expected Result**: Status updates successfully, and an email/notification is queued for the user.
