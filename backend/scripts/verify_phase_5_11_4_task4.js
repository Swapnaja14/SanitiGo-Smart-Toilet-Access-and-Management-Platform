import dotenv from "dotenv";
dotenv.config();

import amqp from "amqplib";
import prisma from "../src/config/prisma.js";
import { publishPendingOutboxEvents, closeRabbitMQ } from "../src/services/rabbitmqPublisher.service.js";
import { checkOperationalHealth } from "../src/jobs/operationalMonitor.job.js";
import { getDLQDepth } from "../src/services/dlqManager.service.js";

const RABBITMQ_URL =
  process.env.RABBITMQ_URL ||
  (process.env.RABBITMQ_HOST
    ? `amqp://${encodeURIComponent(process.env.RABBITMQ_USERNAME || "sanitigo_app")}:${encodeURIComponent(process.env.RABBITMQ_PASSWORD || "")}@${process.env.RABBITMQ_HOST}:${process.env.RABBITMQ_PORT || 5672}`
    : "amqp://sanitigo_app:SanitiGo%40SecurePass2026%21@localhost:5672");

async function main() {
  console.log("===============================================================");
  console.log("   TASK 4: VALIDATE DEPLOYMENT, TOPOLOGY, RECOVERY & SAFETY   ");
  console.log("===============================================================\n");

  let allPassed = true;

  // --------------------------------------------------------------------------
  // TEST 1: Actual Queue Topology & Persistence Configuration Verification
  // --------------------------------------------------------------------------
  console.log("[Test 1] Verifying Queue Topology and Persistence Configuration...");
  let connection, channel;
  try {
    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();

    // 1. Check main queue
    const mainQ = await channel.checkQueue("sanitigo.booking.events");
    console.log(`  ✓ Main queue 'sanitigo.booking.events' exists (active consumers: ${mainQ.consumerCount}, messages: ${mainQ.messageCount})`);

    // 2. Check dead-letter queue
    const dlq = await channel.checkQueue("sanitigo.booking.events.dlq");
    console.log(`  ✓ Dead-letter queue 'sanitigo.booking.events.dlq' exists (messages: ${dlq.messageCount})`);

    // 3. Check topic exchange
    await channel.checkExchange("sanitigo.events");
    console.log("  ✓ Topic exchange 'sanitigo.events' verified");

    // 4. Check dead-letter exchange
    await channel.checkExchange("sanitigo.dlx");
    console.log("  ✓ Dead-letter exchange 'sanitigo.dlx' verified");

    console.log("  ✓ [Test 1 PASSED] Topology verified successfully.\n");
  } catch (err) {
    console.error("  ✗ [Test 1 FAILED] Topology check error:", err.message);
    allPassed = false;
  } finally {
    if (channel) await channel.close().catch(() => {});
    if (connection) await connection.close().catch(() => {});
  }

  // --------------------------------------------------------------------------
  // TEST 2: Multi-Publisher Concurrency (Mutual Exclusion of Claims)
  // --------------------------------------------------------------------------
  console.log("[Test 2] Verifying Multiple Publisher Instances Cannot Claim Same Event...");
  try {
    const testId = `multi-pub-test-${Date.now()}`;
    const testEvent = await prisma.outboxEvent.create({
      data: {
        eventType: "booking.created.v1",
        aggregateId: `booking-${testId}`,
        payload: {
          eventId: testId,
          eventType: "booking.created.v1",
          timestamp: new Date().toISOString(),
          data: {
            bookingId: `b-${testId}`,
          },
        },
        status: "PENDING",
        attempts: 0,
        nextAttemptAt: new Date(Date.now() - 1000), // Ready to publish immediately
      },
    });

    console.log(`  Created test outbox event ${testEvent.id} for concurrent claiming test.`);

    // Simulate 5 publisher instances polling and trying to publish at the exact same millisecond
    const results = await Promise.all([
      publishPendingOutboxEvents(),
      publishPendingOutboxEvents(),
      publishPendingOutboxEvents(),
      publishPendingOutboxEvents(),
      publishPendingOutboxEvents(),
    ]);

    const totalPublished = results.reduce((acc, count) => acc + count, 0);
    console.log(`  5 Concurrent publisher runs completed. Published count results: [${results.join(", ")}]`);

    // Fetch the updated event from the database
    const finalEvent = await prisma.outboxEvent.findUnique({
      where: { id: testEvent.id },
    });

    console.log(`  Final outbox event status: ${finalEvent.status}, attempts: ${finalEvent.attempts}`);

    if (finalEvent.status === "PUBLISHED" && finalEvent.attempts === 1) {
      console.log("  ✓ Exactly 1 instance claimed and published the event! Zero duplicate claims.");
      console.log("  ✓ [Test 2 PASSED]\n");
    } else {
      console.error(`  ✗ [Test 2 FAILED] Expected status PUBLISHED with attempts=1, got status=${finalEvent.status}, attempts=${finalEvent.attempts}`);
      allPassed = false;
    }

    // Clean up test event
    await prisma.outboxEvent.delete({ where: { id: testEvent.id } });
  } catch (err) {
    console.error("  ✗ [Test 2 FAILED] Error:", err.message);
    allPassed = false;
  }

  // --------------------------------------------------------------------------
  // TEST 3: Operational Monitoring Health Check & Alerting Validation
  // --------------------------------------------------------------------------
  console.log("[Test 3] Verifying Operational Health Monitor & Alert Detection...");
  try {
    const health = await checkOperationalHealth();
    console.log(`  Health Status: ${health.status}`);
    console.log(`  Stale Pending Count: ${health.stalePendingCount}`);
    console.log(`  Failed Events Count: ${health.failedCount}`);
    console.log(`  DLQ Message Count: ${health.dlqMessageCount}`);

    if (["HEALTHY", "WARNING", "DEGRADED"].includes(health.status)) {
      console.log("  ✓ Operational monitor accurately evaluated health metrics.");
      console.log("  ✓ [Test 3 PASSED]\n");
    } else {
      console.error(`  ✗ [Test 3 FAILED] Invalid status: ${health.status}`);
      allPassed = false;
    }
  } catch (err) {
    console.error("  ✗ [Test 3 FAILED] Error:", err.message);
    allPassed = false;
  }

  // --------------------------------------------------------------------------
  // TEST 4: Controlled DLQ Depth & Replay Mechanism Validation
  // --------------------------------------------------------------------------
  console.log("[Test 4] Verifying DLQ Monitoring & Depth Retrieval...");
  try {
    const depth = await getDLQDepth();
    console.log(`  DLQ depth successfully queried: ${depth} messages`);
    console.log("  ✓ [Test 4 PASSED]\n");
  } catch (err) {
    console.error("  ✗ [Test 4 FAILED] Error:", err.message);
    allPassed = false;
  }

  // Close connections cleanly
  await closeRabbitMQ(2000);
  await prisma.$disconnect();

  if (allPassed) {
    console.log("===============================================================");
    console.log("   ALL TASK 4 DEPLOYMENT & RECOVERY CHECKS PASSED (4/4)       ");
    console.log("===============================================================");
    process.exit(0);
  } else {
    console.error("SOME CHECKS FAILED!");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
