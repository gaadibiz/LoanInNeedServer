# Infrastructure Testing Plan

## Overview
This document ensures the underlying infrastructure (network, servers, orchestrators) operates correctly under different conditions and validates environmental configurations.

## Test Cases

### TC-INF-001: Network Partition Tolerance
- **Description**: Simulate a network drop between the application server and the database.
- **Expected Result**: Application logs the connection failure and attempts to reconnect gracefully without crashing.

### TC-INF-002: Server Restart Recovery Time
- **Description**: Perform a hard restart of the main backend server during active use.
- **Expected Result**: Server re-initializes and begins accepting traffic within 10 seconds. In-flight stateless requests can be retried by the client.

### TC-INF-003: Load Balancer Traffic Distribution
- **Description**: Send 10,000 requests through the load balancer with multiple backend nodes running.
- **Expected Result**: Traffic is distributed evenly (e.g., Round Robin) among healthy nodes.

### TC-INF-004: Auto-Scaling Trigger Validation
- **Description**: Artificially increase CPU utilization to >80% for 5 minutes.
- **Expected Result**: The infrastructure orchestrator provisions and attaches a new instance to the load balancer automatically.

### TC-INF-005: Environment Configuration Isolation
- **Description**: Attempt to access production resources from the staging/dev environment.
- **Expected Result**: Network rules (VPCs, security groups) block the access entirely.

### TC-INF-006: SSL/TLS Certificate Validation
- **Description**: Attempt connection using older, deprecated TLS versions (e.g., TLS 1.0).
- **Expected Result**: Connection is rejected. Only TLS 1.2+ is supported.
