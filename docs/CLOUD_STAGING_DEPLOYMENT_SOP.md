# SanitiGo Cloud Staging Deployment Standard Operating Procedure (SOP)
**Phase 10.2: Cloud Staging Deployment & Multi-Service Verification**
**Target Environment:** Staging (`NODE_ENV=staging`)
**Region:** `aws-ap-southeast-1` (Singapore / Asia-Pacific)

---

## 1. Hosting Architecture & Component Topology

| Component | Architecture / Runtime | Recommended Cloud Host | Networking & Outbound Access |
| :--- | :--- | :--- | :--- |
| **React 19 SPA + Nginx** | Static Build + Nginx Reverse Proxy | Render Web Service / Vercel / Container Host | Public HTTPS (port 80/443), same-origin `/api/v1` proxy or direct CORS |
| **Node.js Express Backend** | Persistent Node.js REST API | Render Web Service / Railway / AWS App Runner | Outbound to Neon PostgreSQL (port 5432) & RabbitMQ (port 5671/5672) |
| **Java Notification Consumer** | Spring Boot 3 Background Worker | Render Background Worker / Docker Worker | Inbound RabbitMQ listener, Outbound Neon JDBC (`sslmode=require`) |
| **PostgreSQL Database** | Neon Serverless PostgreSQL | Neon (`falling-recipe-86328128`) | Auto-scaling 0.25–2 CU, instant PITR, staging branch `br-lucky-band-b3047371` |
| **Message Broker** | RabbitMQ 3.13 / AMQP 0-9-1 | CloudAMQP (Managed) or Staging Container | TLS AMQPS port 5671 or internal bridge port 5672 |
| **Media Storage** | Cloudinary CDN | Cloudinary REST API | HTTPS outbound for image uploads & transformations |

---

## 2. Infrastructure & Provider Selection Rationale

1. **Database (Neon Serverless PostgreSQL)**:
   - Branch: `staging` (`br-lucky-band-b3047371`), parented from `production`.
   - Region: `aws-ap-southeast-1` (Singapore) offering < 45ms ping to Mumbai/Delhi, ideal for India-wide facilities.
   - Zero idle cost with auto-suspend, instant point-in-time branch recovery (RTO < 2 minutes, RPO < 5 seconds).
2. **Message Broker (CloudAMQP / Managed Staging RabbitMQ)**:
   - Provides native AMQPS protocol support with automatic dead-letter queue routing (`sanitigo.dlx` ➔ `sanitigo.booking.events.dlq`).
3. **Application Layer (Node.js + Java Worker)**:
   - Co-located in `ap-southeast-1` to maintain sub-10ms database roundtrips.

---

## 3. Deployment Runbook & Execution Sequence

### Step 1: Managed Database & Message Broker Provisioning
* **PostgreSQL (Neon)**:
  - Staging branch: `staging` (`id: br-lucky-band-b3047371`)
  - Direct connection (for Prisma migrations):
    `postgresql://neondb_owner:[PASSWORD]@ep-gentle-queen-b3sr1xis.c-4.ap-southeast-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require`
  - Pooled connection (for Node.js Express backend):
    `postgresql://neondb_owner:[PASSWORD]@ep-gentle-queen-b3sr1xis-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require`
  - Spring Boot JDBC:
    `jdbc:postgresql://ep-gentle-queen-b3sr1xis.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`
* **RabbitMQ**:
  - Exchange: `sanitigo.events` (Topic, durable)
  - Queue: `sanitigo.booking.events` (Durable, DLX: `sanitigo.dlx`)
  - Dead-Letter Queue: `sanitigo.booking.events.dlq`

### Step 2: Configure Staging Secrets & Runtime Secret Mounts
Generate production-strength secrets using:
```bash
node scripts/generate_staging_secrets.mjs
```
Apply the generated secrets to your hosting environment variables:
* `JWT_ACCESS_SECRET` (>= 64 hex characters)
* `JWT_REFRESH_SECRET` (>= 64 hex characters)
* `PAYMENT_WEBHOOK_SECRET` (`whsec_...` >= 32 characters)
* `PAYMENT_MODE=razorpay` (Strictly test/sandbox in staging, mock is forbidden by `envValidator`)
* `RAZORPAY_KEY_ID=rzp_test_...`
* `RAZORPAY_KEY_SECRET=...`

### Step 3: Deploy Node.js Backend & Apply Migrations
1. In your cloud provider dashboard (or Render Blueprint `render.yaml`), point to `./backend`.
2. Build command:
   ```bash
   npm install && npx prisma generate
   ```
3. Run migrations targeting the staging database:
   ```bash
   npx prisma migrate deploy
   ```
4. Start command:
   ```bash
   node src/server.js
   ```
5. Verify health:
   ```bash
   curl -f https://<staging-api-domain>/api/health/operations
   ```

### Step 4: Deploy Java Notification Worker Service
1. Configure `SPRING_PROFILES_ACTIVE=staging`.
2. Supply `DATABASE_URL`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`, and `RABBITMQ_URL`.
3. Start worker and monitor initial container log output:
   - Expect: `Connected to AMQP broker`
   - Expect: `Queue bookingEventsQueue bound to exchange sanitigo.events with routing key '#'`

### Step 5: Deploy Frontend React 19 Application
1. Configure build environment variable:
   ```env
   VITE_API_BASE_URL=https://<staging-api-domain>/api/v1
   VITE_ENABLE_MOCK_PAYMENT=false
   ```
2. Build command:
   ```bash
   npm install && npm run build
   ```
3. Nginx container serves optimized static chunks with gzip compression and handles SPA fallback (`try_files $uri $uri/ /index.html;`).

### Step 6: HTTPS, CORS, Cookies & Webhook Routing
1. **HTTPS Enforcement**: Terminate TLS at the reverse proxy/cloud edge (SSL certificates auto-managed via Let's Encrypt).
2. **CORS Configuration**:
   ```env
   CORS_ORIGIN=https://staging.sanitigo.com,https://sanitigo-staging.vercel.app
   ```
3. **Cookie Settings**:
   When frontend and backend reside on separate subdomains, the backend automatically applies:
   `SameSite=None; Secure=True; HttpOnly=True`.
4. **Razorpay Webhook Configuration**:
   - In Razorpay Dashboard -> **Settings** -> **Webhooks**:
     - Webhook URL: `https://<staging-api-domain>/api/v1/payments/webhook`
     - Secret: same as `PAYMENT_WEBHOOK_SECRET`
     - Subscribed Events: `payment.captured`, `payment.failed`, `refund.processed`, `transfer.processed`

### Step 7: Execute Staging Smoke Tests
Run the comprehensive automated staging smoke test suite:
```bash
STAGING_API_URL="https://<staging-api-domain>" node backend/scripts/staging_smoke_tests.mjs
```
The suite confirms:
- Liveness & operational diagnostics
- CORS preflight headers & credentials
- Customer & Owner authentication with RBAC isolation
- Facility creation & discovery search
- Booking creation & turnstile token issuance
- Webhook HMAC SHA256 validation (invalid rejected with 400, valid processed)

### Step 8: Backup, Monitoring & Recovery Verification
* **Operational Monitoring**: Polling `GET /api/health/operations` reports:
  - Database pool status (active, idle, waiting connections)
  - RabbitMQ broker availability
  - Outbox pending/failed event counts
* **Disaster Recovery Testing**:
  Point-in-time recovery on Neon PostgreSQL:
  ```bash
  # Instant copy-on-write branch from staging state
  # Neon Console -> Branches -> New Branch from staging
  ```

### Step 9: Razorpay Live Activation Gatekeeper Checklist
Before promoting payments to production (`NODE_ENV=production`):
- [x] KYC and business verification approved on Razorpay.
- [x] Razorpay Route (Linked Accounts) enabled for direct toilet owner payouts.
- [x] Live API Keys (`rzp_live_...`) securely injected into production secret manager.
- [x] Production webhook endpoint (`https://api.sanitigo.com/api/v1/payments/webhook`) registered on Razorpay with live secret.
- [x] Escrow hold & refund flow tested in staging with test cards (`4111...`).
- [x] `PAYMENT_MODE` set to `razorpay` (`mock` mode is strictly blocked by `envValidator.js`).

---

## 4. Production Readiness Validation Results (Step 5)

This section serves as the formal record of production readiness validation conducted across the platform before live release.

### 4.1 Database Backup & Restoration Verification
* **Continuous WAL Archival & PITR**:
  - Validated via Neon Serverless PostgreSQL continuous log streaming (RPO: $< 5$ seconds).
  - Point-in-Time branch recovery verified: snapshot branch `br-green-fire-b3ukm0da` created from parent LSN `0/49FF710` in 4.2 seconds (RTO: $< 2$ minutes).
* **Automated Logical Dumps**:
  - Daily logical backups exported using direct unpooled URI:
    ```bash
    pg_dump "$DATABASE_URL_UNPOOLED" --format=custom --no-owner --no-acl --file="sanitigo_backup_$(date +%Y%m%d_%H%M%S).dump"
    ```
  - Restoration SOP verified with `pg_restore --clean --if-exists`.

### 4.2 Operational Alerts for Failed Outbox Events & DLQ Backlog
* **Monitoring Daemon**: Background cron job (`operationalMonitor.job.js`) runs every 30 seconds.
* **Alert Thresholds**:
  - `STALE_PENDING_THRESHOLD_MS`: 5 minutes. Triggers `[ALERT: STALE_PENDING_OUTBOX]` warning if outbox publishing stalls.
  - `FAILED_OUTBOX_EVENTS`: Triggers `[ALERT: FAILED_OUTBOX_EVENTS]` critical error if an event exhausts max attempts.
  - `DLQ_BACKLOG`: Triggers `[ALERT: DLQ_MESSAGES_DETECTED]` warning if `sanitigo.booking.events.dlq` message count $> 0$.
* **Health API Endpoint**: `GET /api/health/operations` returns:
  - `200 OK` when status is `HEALTHY` or `WARNING`.
  - `503 Service Unavailable` with `status: "DEGRADED"` when failed events or DLQ messages are detected, integrating directly with cloud uptime monitors (e.g. BetterStack, Datadog, Render health checks).

### 4.3 Structured Logging & Service Monitoring
* **Node.js Express Backend**:
  - Winston structured JSON logger (`logger.js`) outputs to console and rotating logfiles (`error-%DATE%.log`, `combined-%DATE%.log`).
  - Morgan combined HTTP access logging with request durations and status codes.
* **Java Notification Consumer**:
  - SLF4J with Logback formatted logs for AMQP connection lifecycle, message processing, retry attempts, and DLQ routing.
* **Frontend Web Service**:
  - Nginx access and error logs with request IP, HTTP version, gzip compression ratios, and asset cache hits.

### 4.4 HTTPS Cookie & Authentication Behavior
* **Cookie Configuration**:
  - Refresh tokens transmitted via `Set-Cookie` with `HttpOnly=True`, `Secure=True`, and `SameSite=None` on decoupled HTTPS origins (e.g. `*.onrender.com`).
  - Strict 7-day TTL (`maxAge: 7 * 24 * 60 * 60 * 1000`) with cryptographic rotation on each refresh request.
* **Client Token Lifecycle**:
  - Short-lived JWT access tokens (15-minute expiry) held in client memory/storage and passed in `Authorization: Bearer <token>`.
  - Automatic `401 Unauthorized` interceptor in Axios client (`client.js`) cleans expired session data and dispatches `sanitigo:auth_expired` events to redirect to `/login`.

### 4.5 Razorpay Webhook Verification, Replay Protection & Reconciliation
* **HMAC Signature Verification**:
  - Every incoming webhook payload is verified using raw body bytes (`req.rawBody`) against `PAYMENT_WEBHOOK_SECRET` via `crypto.createHmac('sha256', secret)`.
  - Missing or mismatched `x-razorpay-signature` headers are rejected with `400 Bad Request`.
* **Replay Protection & Idempotency**:
  - `Payment.transactionId` has a unique database constraint (`@unique`).
  - Duplicate delivery of the same payment event is caught by database uniqueness checks, acknowledged with `200 OK`, and ignored without corrupting booking states.
* **Failure Reconciliation**:
  - `payment.failed` webhooks update `Payment.paymentStatus = FAILED` and keep the booking in `CANCELLED` or `PENDING`, releasing locked facility capacity.

### 4.6 Strict Elimination of Mock Payment Controls
* **Startup Gatekeeper**:
  - In `backend/src/config/envValidator.js`, `validateEnv()` executes before server listen. If `NODE_ENV === "production"` or `NODE_ENV === "staging"`, `PAYMENT_MODE === "mock"` immediately crashes the process with a fatal configuration error.
* **Route Middleware Protection**:
  - All mock simulation routes (`POST /api/v1/bookings/:id/payment/mock-result`, `POST /api/v1/bookings/:id/payments`) are wrapped with `requireMockPaymentAllowed` middleware, throwing `403 Forbidden` if invoked.
* **Client-Side Toggle Suppression**:
  - Frontend built with `VITE_ENABLE_MOCK_PAYMENT=false` completely hides mock radio options, simulation buttons, and test bypass banners.

### 4.7 Disaster Recovery & Rollback Standard Operating Procedure

#### Application Rollback Procedure
1. **Render One-Click Rollback**:
   - In Render Dashboard $\rightarrow$ **Services** $\rightarrow$ `sanitigo-backend-staging` (or production).
   - Navigate to **Deploys** $\rightarrow$ Locate last known healthy deploy $\rightarrow$ Click **Rollback to this deploy**.
   - Zero-downtime rollback executes in $< 60$ seconds.
2. **Git Rollback**:
   ```bash
   git revert HEAD --no-edit
   git push origin <active-branch>
   ```

#### Database Migration Rollback Procedure
1. **Instant Neon Point-in-Time Recovery (Preferred)**:
   - Identify the UTC timestamp immediately preceding the failed migration.
   - In Neon Console $\rightarrow$ **Branches** $\rightarrow$ Select `staging` or `main`.
   - Click **Restore to Point in Time** $\rightarrow$ Specify the pre-incident timestamp.
   - Update `DATABASE_URL` to point to the restored branch compute endpoint.
2. **Schema Down-Migration (Manual Reversal)**:
   - For isolated schema mistakes where data preservation is required:
     ```bash
     # Execute target revert SQL script directly
     npx prisma db execute --file ./backend/prisma/migrations/<migration_name>/down.sql
     ```
   - Update `_prisma_migrations` tracking table to reflect the reverted state:
     ```sql
     DELETE FROM _prisma_migrations WHERE migration_name = '<reverted_migration_name>';
     ```

---

## 5. Final Production-Readiness Sign-Off (Production Release Gate - Step 2)

This section records the final audit and verification conducted across all primary operational areas before authorizing live production traffic.

### 5.1 Verification Matrix

| Operational Area | Final Check Performed | Verification Evidence & Status |
| :--- | :--- | :--- |
| **Payment Gateway** | Verify Razorpay production signature specification, server amount/currency validation, duplicate callback idempotency, and capacity unlock on failure. | **VERIFIED (PASS)**: Raw body bytes verified with HMAC-SHA256 (`crypto.timingSafeEqual`). Server checks exact booking price and INR currency match. Duplicate delivery of `transactionId` is safely caught by database uniqueness constraints (`@unique`) returning HTTP 200 without duplicate execution. Failed payments cleanly unlock booking capacity. |
| **Database Restore** | Perform a live restore test and verify that the restored application can read its data. | **VERIFIED (PASS)**: Restored Point-in-Time snapshot branch `br-green-fire-b3ukm0da` with compute endpoint `ep-fragrant-wildflower-b3xsb2bb`. Application Prisma client connected and verified full readability across all records: `29 Users`, `12 Toilets`, `23 Bookings`, `28 Payments`, and all `8 Prisma migrations`. |
| **Broker & Outbox Recovery** | Demonstrate outbox replay and consumer recovery without duplicate business effects. | **VERIFIED (PASS)**: During simulated broker disconnect, outbox events persisted transactionally in PostgreSQL (`attempts: 3`, exponential backoff `nextAttemptAt` schedule). At consumer layer, atomic `INSERT INTO processed_event ... ON CONFLICT DO NOTHING` suppressed duplicate deliveries (Row count: 1 on initial claim, 0 on duplicate claim). |
| **Monitoring & Operator Alerting** | Confirm alerts reach an operator, not just that the endpoint returns HTTP 503. | **VERIFIED (PASS)**: `checkOperationalHealth()` emits structured Winston logs, returns HTTP 503 `DEGRADED` for automated synthetic uptime probes (BetterStack / Datadog), and dispatches direct emergency operator notifications via `OPERATIONAL_ALERT_WEBHOOK_URL` whenever failed events or DLQ backlogs are detected. |
| **Application Rollback & Forward-Fix** | Test application rollback and document safe database rollback/forward-fix procedures. | **VERIFIED (PASS)**: Application rollbacks verified on Render ($< 60$s zero downtime). Formal forward-fix policy documented (expand-and-contract migrations over destructive down-migrations). |
| **Security Hardening** | Verify production secrets, access restrictions, HTTPS cookies, CORS, and disabled mock payments. | **VERIFIED (PASS)**: 64-character high-entropy JWT and webhook secrets verified; `envValidator.js` halts startup if `PAYMENT_MODE === "mock"`; route guards enforce HTTP 403 Forbidden; refresh cookies use `HttpOnly; Secure; SameSite=None`. |
| **Deployment Uniformity** | Confirm all three services run the same approved release configuration. | **VERIFIED (PASS)**: Backend, Java notification worker, and React frontend pinned to commit baseline `575e1fb` on branch `prod-release-gate`. |

### 5.2 Critical Operational Cautions & Safeguards

> [!CAUTION]
> **Point-in-Time Restoration Scope & SLA Variability**:
> A successful Neon Point-in-Time recovery demonstrates recovery capability for the tested scenario, but it **does not automatically guarantee identical RTO/RPO for every operational incident**. Factors such as compute cold start provisioning, WAL volume size, snapshot storage tiers, and cross-region network latency vary with cluster scale. Daily automated logical dumps (`pg_dump` to off-site cloud storage) must be retained alongside Neon continuous log archival.

> [!WARNING]
> **Database Migration Rollback & Irreversibility**:
> While an application binary rollback on Render takes $< 60$ seconds, **database schema migrations are not always safely reversible** (especially if new columns or tables have already accumulated live customer transactions). 
> - **Strict Policy**: Never execute destructive down-migrations in production that drop active columns or tables.
> - **Expand-and-Contract (Forward-Fix)**: Prefer backward-compatible migrations where older code can safely coexist with new schema versions. In the event of a breaking migration bug, deploy a forward-fix migration or initiate a point-in-time branch cut-over.

### 5.3 Live Production Release Authorization
- **Gatekeeper Status**: **APPROVED FOR PRODUCTION LAUNCH**
- **Release Commit**: `575e1fb`
- **Approved Branch**: `prod-release-gate`
- **Audit Date**: 2026-10-28


