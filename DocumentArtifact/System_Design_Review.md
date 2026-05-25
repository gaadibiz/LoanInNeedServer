# LoanInNeed System Design & Architecture Review

This document summarizes the core systemic design issues discovered in the LoanInNeed Node.js backend. It serves as an educational note to understand why the application faced downtime, timeouts, and memory crashes under scale.

---

## 1. Connection Exhaustion (The "11 Prisma Clients" Anti-Pattern)

### The Architecture Problem
In Node.js applications, a database ORM like Prisma manages a **Connection Pool** to the database (e.g., PostgreSQL). By default, a single `new PrismaClient()` creates a pool of connections (e.g., 10-20 connections).
In this codebase, every individual model file (`userModel.js`, `loanModel.js`, `kycModel.js`, etc.) executed its own `new PrismaClient()`. 

### Why It Broke
With 11 different models, a single backend instance generated **11 distinct connection pools**. If each pool opens just 10 connections, one server instance instantly demands 110 connections from PostgreSQL. When the app scales on DigitalOcean to handle traffic, or restarts, it overwhelms the database connection limit, resulting in `FATAL: sorry, too many clients already`.

### The Design Principle
**Singleton Pattern for Database Connections:** You should instantiate exactly *one* global connection pool when the application starts, and pass that instance to all models.

---

## 2. In-Memory Data Loading (The OOM Crash)

### The Architecture Problem
When an admin clicked "Export", the backend needed to gather loan applications, user details, employment data, and all associated documents. The initial approach used Prisma's `findMany` with deeply nested `include` statements.

### Why It Broke
Object-Relational Mappers (ORMs) map SQL results to memory. When fetching hundreds of applications with heavily nested relationships, Prisma pulls the entire dataset into RAM at once. As the platform gained users, pulling 150+ loans simultaneously created a multi-gigabyte memory spike in Node.js. Node.js ran Out of Memory (OOM) and abruptly crashed.

### The Design Principle
**Cursor-based Chunking & Streaming:** Never load an unbounded dataset into memory. The fix involved querying *only the IDs* first, then downloading, processing, and HTTP-streaming the full data in small chunks (e.g., 4 at a time).

---

## 3. The Proxy Timeout Issue (The 504 Gateway & "Aborted" Error)

### The Architecture Problem
The architecture consists of a backend API and an intermediate Proxy Server (`LoanViewerApp/server.js`) that the admin dashboard talks to. The LOS system requires documents in Base64 format, which takes roughly 40-50 seconds to download from S3 and encode for a large batch.

### Why It Broke
There were two tight timeouts layered on top of each other:
1. **DigitalOcean Load Balancer Timeout:** DO drops idle HTTP connections after 60 seconds. Fixed by using **HTTP Chunked Streaming** (`res.write()`), which bypasses the idle timer by continuously dripping data.
2. **Axios Hardcoded Timeout:** The intermediate Proxy server had a hardcoded `timeout: 30000` (30 seconds). Even though the backend was successfully streaming data, the Proxy violently severed the connection at exactly 30 seconds, surfacing an `aborted` error to the UI.

### The Design Principle
**Timeouts on Long-Running Tasks:** When building data-heavy export APIs, strict HTTP timeouts will always cause failures. If a synchronous HTTP response takes longer than 15-20 seconds, it should either be streamed, or converted into an asynchronous job (e.g., "Export Queued -> We'll email you the CSV").

---

## 4. Race Conditions in Data Creation (Data Integrity)

### The Architecture Problem
When saving KYC documents (`kycService.js`), the code checked if a record existed, and if not, created it:
```javascript
let employment = await EmploymentModel.findByUserId(userId);
if (!employment) {
   await EmploymentModel.create(...);
}
```

### Why It Broke
This is known as a **Check-Then-Act Race Condition**. If a user double-clicks the "Submit" button, or an external API retries a request, two parallel threads enter this block simultaneously. Both threads see that `employment` does not exist, and both attempt to `create()`. The database's strict rules then throw a `Unique Constraint Violation` error.

### The Design Principle
**Atomic Database Operations:** Always push concurrent conflict resolution to the database layer. Using atomic operations like `Upsert` (Update or Insert) guarantees that the database engine itself handles the lock, completely eliminating the race condition.

---

## 5. Missing Foreign Key Indexes (Sequential Scans)

### The Architecture Problem
In PostgreSQL, creating a relation (e.g., `userId` inside the `LoanApplication` table) does not automatically create an index for it. 

### Why It Broke
When fetching loans belonging to a specific user, the database had to read every single row in the `LoanApplication` table to find the matches (a Sequential Scan). As the table grows to thousands of records, these scans eat up 100% of the database CPU.

### The Design Principle
**Database Indexing:** Any foreign key column frequently used in `WHERE` or `JOIN` clauses must explicitly have a B-Tree index defined (e.g., `@@index([userId])` in Prisma).
