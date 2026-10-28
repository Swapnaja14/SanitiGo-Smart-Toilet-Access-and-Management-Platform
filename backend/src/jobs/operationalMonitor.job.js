import cron from "node-cron";
import prisma from "../config/prisma.js";
import logger from "../config/logger.js";
import { getDLQDepth } from "../services/dlqManager.service.js";

// Alert thresholds
const STALE_PENDING_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Checks system operational health:
 * 1. Stale PENDING outbox records (> 5 minutes)
 * 2. FAILED outbox events
 * 3. Dead-Letter Queue (DLQ) depth
 */
export async function checkOperationalHealth() {
  const staleDate = new Date(Date.now() - STALE_PENDING_THRESHOLD_MS);

  // 1. Query stale PENDING events
  const stalePendingEvents = await prisma.outboxEvent.findMany({
    where: {
      status: "PENDING",
      createdAt: { lte: staleDate },
    },
    select: {
      id: true,
      eventType: true,
      attempts: true,
      createdAt: true,
      lastError: true,
    },
    take: 20,
  });

  // 2. Query FAILED events
  const failedEvents = await prisma.outboxEvent.findMany({
    where: {
      status: "FAILED",
    },
    select: {
      id: true,
      eventType: true,
      attempts: true,
      createdAt: true,
      lastError: true,
    },
    take: 20,
  });

  // 3. Query DLQ Depth
  const dlqDepth = await getDLQDepth();

  // Issue Alerts if abnormal conditions are found
  if (stalePendingEvents.length > 0) {
    logger.warn(
      `[ALERT: STALE_PENDING_OUTBOX] Detected ${stalePendingEvents.length} outbox event(s) pending for > 5 minutes! ` +
        `Oldest: ${stalePendingEvents[0].id} (${stalePendingEvents[0].eventType}, created ${stalePendingEvents[0].createdAt.toISOString()})`
    );
  }

  if (failedEvents.length > 0) {
    logger.error(
      `[ALERT: FAILED_OUTBOX_EVENTS] Detected ${failedEvents.length} permanently FAILED outbox event(s)! ` +
        `IDs: [${failedEvents.map((e) => e.id).join(", ")}]`
    );
  }

  if (dlqDepth > 0) {
    logger.warn(
      `[ALERT: DLQ_MESSAGES_DETECTED] Dead-Letter Queue 'sanitigo.booking.events.dlq' contains ${dlqDepth} unconsumed message(s). ` +
        `Run DLQ replay procedure to investigate and retry.`
    );
  }

  const isDegraded = failedEvents.length > 0 || dlqDepth > 0;

  // Direct Operator Alert Dispatch (Webhook / PagerDuty / Slack)
  if (isDegraded && process.env.OPERATIONAL_ALERT_WEBHOOK_URL) {
    try {
      fetch(process.env.OPERATIONAL_ALERT_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alert: "CRITICAL_PLATFORM_HEALTH_DEGRADED",
          timestamp: new Date().toISOString(),
          failedEventsCount: failedEvents.length,
          dlqDepth,
          stalePendingCount: stalePendingEvents.length,
          failedEventIds: failedEvents.map((e) => e.id),
        }),
      }).catch((err) => logger.warn(`[AlertWebhook] Failed to send operator alert: ${err.message}`));
    } catch (dispatchErr) {
      logger.warn(`[AlertWebhook] Dispatch error: ${dispatchErr.message}`);
    }
  }

  return {
    timestamp: new Date().toISOString(),
    status:
      isDegraded
        ? "DEGRADED"
        : stalePendingEvents.length > 0
        ? "WARNING"
        : "HEALTHY",
    stalePendingCount: stalePendingEvents.length,
    failedCount: failedEvents.length,
    dlqMessageCount: dlqDepth,
    stalePendingEvents,
    failedEvents,
  };
}

/**
 * Starts scheduled operational monitoring (runs every 30 seconds).
 */
export const startOperationalMonitor = () => {
  return cron.schedule("*/30 * * * * *", async () => {
    try {
      await checkOperationalHealth();
    } catch (error) {
      logger.error(`[OperationalMonitor] Health check failed: ${error.message}`);
    }
  });
};

export default {
  checkOperationalHealth,
  startOperationalMonitor,
};
