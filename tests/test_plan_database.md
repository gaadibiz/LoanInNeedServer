# Database Testing Plan

## Overview
This document focuses on data integrity, database performance, schema validation, and fault tolerance at the data layer.

## Test Cases

### TC-DB-001: ACID Properties Verification
- **Description**: Perform a multi-table transaction and simulate a failure midway.
- **Expected Result**: The entire transaction rolls back perfectly, leaving no orphaned records.

### TC-DB-002: Index Performance on Large Tables
- **Description**: Query the largest table using indexed vs non-indexed columns.
- **Expected Result**: Queries on indexed columns (e.g., email, status) complete in <50ms.

### TC-DB-003: Foreign Key Constraint Validation
- **Description**: Attempt to delete a user who has active loan applications.
- **Expected Result**: Database prevents deletion due to foreign key constraints (or cascades safely if configured).

### TC-DB-004: Database Failover and Recovery
- **Description**: Shut down the primary database node.
- **Expected Result**: The system automatically promotes a read-replica to primary with minimal downtime (<30s).

### TC-DB-005: Data Integrity on Incomplete Data Types
- **Description**: Insert a string into an integer field or a malformed date.
- **Expected Result**: The ORM/Database rejects the query with a type error.

### TC-DB-006: Long-Running Query Timeout
- **Description**: Execute an intentionally complex, unoptimized JOIN query.
- **Expected Result**: The query times out after 10 seconds, preventing DB lockup.
