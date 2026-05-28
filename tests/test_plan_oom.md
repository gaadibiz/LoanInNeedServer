# Out of Memory (OOM) Testing Plan

## Overview
This document outlines the test cases designed to evaluate the system's behavior under extreme memory pressure and to identify potential memory leaks or inefficient memory usage patterns.

## Test Cases

### TC-OOM-001: Massive File Upload Memory Usage
- **Description**: Upload files significantly larger than the recommended size limit concurrently.
- **Expected Result**: System should gracefully reject the file or stream it without crashing the Node.js process. Memory usage should not exceed 85% of total allocated RAM.

### TC-OOM-002: Large Database Query Without Pagination
- **Description**: Execute a database query that returns hundreds of thousands of records without pagination.
- **Expected Result**: System should throw a controlled error or timeout rather than exhausting heap memory.

### TC-OOM-003: Memory Leak on Repeated API Calls
- **Description**: Send a continuous stream of standard API requests over an extended period (e.g., 24 hours).
- **Expected Result**: Memory footprint should remain stable after initial warmup. No continuous linear growth in memory allocation.

### TC-OOM-004: Bulk Data Export (JSON/CSV) Memory Limit
- **Description**: Trigger an export of millions of loan records to a CSV/JSON file.
- **Expected Result**: System should use streaming techniques. Heap memory must not spike dangerously, and the export should complete successfully or fail gracefully.

### TC-OOM-005: Large Payload Processing
- **Description**: Send extremely large JSON payloads (e.g., 50MB+) to POST endpoints.
- **Expected Result**: The body parser should reject the payload early with a 413 Payload Too Large error before consuming excessive memory.
