# System Design Testing Plan

## Overview
This document focuses on the architectural resilience, module isolation, and structural integrity of the application.

## Test Cases

### TC-SYS-001: Single Point of Failure (SPOF) Resilience
- **Description**: Simulate the failure of individual components (e.g., Cache server, secondary DB).
- **Expected Result**: System should degrade gracefully or failover seamlessly without total system collapse.

### TC-SYS-002: Microservice / Module Isolation
- **Description**: Intentionally crash a non-critical module (e.g., Notification Service).
- **Expected Result**: Core loan processing services should continue to function normally.

### TC-SYS-003: API Gateway Routing Accuracy
- **Description**: Send malformed and correctly formed requests to the Gateway.
- **Expected Result**: Gateway routes legitimate traffic properly and drops malformed traffic before it hits backend services.

### TC-SYS-004: Asynchronous Task Queue Processing
- **Description**: Flood the background worker queue with heavy tasks (e.g., PDF generation).
- **Expected Result**: The web server remains responsive. Tasks are processed in the background, and failures are retried based on policy.

### TC-SYS-005: Caching Layer Efficiency
- **Description**: Measure DB query frequency with and without Redis/Memcached enabled.
- **Expected Result**: Cache hit ratio should be >80% for frequently accessed, read-heavy endpoints.
