# Scalability Testing Plan

## Overview
This document evaluates the system's capability to scale horizontally and vertically in response to growing workload and data size.

## Test Cases

### TC-SCA-001: Horizontal Scaling With Multiple Nodes
- **Description**: Increase the number of backend node instances from 2 to 6 during high load.
- **Expected Result**: System throughput scales almost linearly. No shared-state issues (like sticky sessions breaking).

### TC-SCA-002: Vertical Scaling Performance Gain
- **Description**: Upgrade the server from 2 vCPUs/4GB RAM to 8 vCPUs/16GB RAM.
- **Expected Result**: Single-node request handling capacity increases proportionally. No artificial software bottleneck prevents hardware utilization.

### TC-SCA-003: Cache Scaling Under High Load
- **Description**: Increase the number of concurrent read operations aggressively with a Redis cluster enabled.
- **Expected Result**: Redis handles the load seamlessly. If a Redis node is added, the cluster rebalances without downtime.

### TC-SCA-004: Database Read Replica Lag Testing
- **Description**: Write a large volume of data to the primary DB and immediately read from the read-replica.
- **Expected Result**: Replication lag stays under 50ms. Application logic handles minor eventual consistency safely.

### TC-SCA-005: Multi-Region Deployment Latency
- **Description**: Simulate users accessing the system from geographically distant regions.
- **Expected Result**: CDNs and edge caching keep static asset load times low, while API requests remain within acceptable global latency limits (<300ms).

### TC-SCA-006: Storage Scalability
- **Description**: Continuously upload documents until storage exceeds current disk allocation.
- **Expected Result**: Block storage dynamically expands or object storage (S3) handles it transparently without "Disk Full" errors.
