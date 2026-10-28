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
- [ ] KYC and business verification approved on Razorpay.
- [ ] Razorpay Route (Linked Accounts) enabled for direct toilet owner payouts.
- [ ] Live API Keys (`rzp_live_...`) securely injected into production secret manager.
- [ ] Production webhook endpoint (`https://api.sanitigo.com/api/v1/payments/webhook`) registered on Razorpay with live secret.
- [ ] Escrow hold & refund flow tested in staging with test cards (`4111...`).
- [ ] `PAYMENT_MODE` set to `razorpay` (`mock` mode is strictly blocked by `envValidator.js`).
