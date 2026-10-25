# SanitiGo Database & Messaging Backup and Disaster Recovery SOP

This document details the backup, retention, and disaster recovery (DR) procedures for the SanitiGo Smart Toilet Access and Management Platform across both development and production environments.

---

## 1. Primary Database: Neon Serverless PostgreSQL

SanitiGo utilizes Neon Serverless PostgreSQL as its production relational database. Neon provides built-in enterprise resilience, point-in-time recovery (PITR), and instant copy-on-write branching.

### 1.1 Continuous Backup & Point-in-Time Recovery (PITR)
* **Write-Ahead Log (WAL) Archival**: Neon continuously streams WAL records to redundant cloud object storage (S3).
* **Recovery Point Objective (RPO)**: Near-zero (seconds).
* **Recovery Time Objective (RTO)**: Under 2 minutes via instant branch creation.
* **Retention Window**: Configurable up to 30 days of continuous PITR history.

#### Point-in-Time Restore Procedure:
1. Navigate to the Neon Console -> **Branches**.
2. Select **New Branch**.
3. Choose the target branch (e.g., `main` or `production`).
4. Select **Point in Time** and specify the exact UTC timestamp prior to the incident/corruption.
5. Create the branch (e.g., `restore-2026-10-25-t140000`).
6. Update `DATABASE_URL` in the environment configuration to point to the newly restored endpoint.
7. Verify application health using `GET /api/health/operations`.

---

## 2. Logical Backups via pg_dump / pg_restore

For offline offsite archiving and regulatory compliance, automated logical dumps should be executed daily.

### 2.1 Generating a Logical Backup
To export a clean snapshot of all schemas and data:
```bash
# Using direct unpooled connection string
pg_dump "$DATABASE_URL_UNPOOLED" \
  --format=custom \
  --no-owner \
  --no-acl \
  --file="sanitigo_backup_$(date +%Y%m%d_%H%M%S).dump"
```

To backup schema only (for migrations verification):
```bash
pg_dump "$DATABASE_URL_UNPOOLED" \
  --schema-only \
  --file="sanitigo_schema_$(date +%Y%m%d).sql"
```

### 2.2 Restoring from a Logical Backup
To restore into a clean staging or recovery database:
```bash
# 1. Create clean database target
createdb -h localhost -p 5432 -U postgres sanitigo_recovered

# 2. Restore schema and data
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  --dbname="$RECOVERY_DATABASE_URL" \
  sanitigo_backup_YYYYMMDD_HHMMSS.dump

# 3. Verify Prisma migration state
npx prisma migrate status
```

---

## 3. RabbitMQ Event Pipeline & State Recovery

### 3.1 Exchange and Queue Definitions
The SanitiGo topology relies on:
- Topic Exchange: `sanitigo.events` (`durable: true`)
- Main Queue: `sanitigo.booking.events` (`durable: true`)
- Dead-Letter Exchange: `sanitigo.dlx` (`direct`, `durable: true`)
- Dead-Letter Queue: `sanitigo.booking.events.dlq` (`durable: true`)

All messages are published with `persistent: true` (delivery mode 2) so RabbitMQ persists messages to disk.

### 3.2 Exporting / Restoring Broker Topology
Export definitions via RabbitMQ Management CLI or HTTP API:
```bash
curl -u sanitigo_app:$RABBITMQ_PASSWORD \
  http://localhost:15672/api/definitions > rabbitmq_definitions_backup.json
```

To restore topology:
```bash
curl -u sanitigo_app:$RABBITMQ_PASSWORD \
  -H "Content-Type: application/json" \
  -X POST \
  -d @rabbitmq_definitions_backup.json \
  http://localhost:15672/api/definitions
```

### 3.3 Transactional Outbox Self-Healing
If RabbitMQ experiences total downtime or restarts with an empty broker:
1. No events are lost because all state changes commit to `OutboxEvent` in PostgreSQL first.
2. Once RabbitMQ is restored, the `outboxPublisher.job.js` worker automatically fetches all pending records with `status = 'PENDING'` and drains them sequentially using publisher confirms.
3. Unprocessable poison-pill messages routed to the DLQ can be inspected and replayed via `dlqManager.service.js` (`replayDLQMessages()`).

---

## 4. Disaster Recovery Drill & Verification Checklist

- [ ] Execute test restore on a secondary branch or local container monthly.
- [ ] Confirm `prisma migrate deploy` succeeds against the clean restored database.
- [ ] Verify that consumer deduplication table (`processed_event`) integrity is intact.
- [ ] Run `npm run test` or `node scripts/audit_e2e_integration.js` against the restored staging environment.
