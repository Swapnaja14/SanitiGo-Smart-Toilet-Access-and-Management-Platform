import amqp from "amqplib";
import prisma from "../config/prisma.js";
import logger from "../config/logger.js";

function getRabbitMQUrl() {
  if (process.env.RABBITMQ_URL) {
    return process.env.RABBITMQ_URL;
  }
  const host = process.env.RABBITMQ_HOST;
  if (!host) return undefined;
  const port = process.env.RABBITMQ_PORT || 5672;
  const username = encodeURIComponent(process.env.RABBITMQ_USERNAME || "sanitigo_app");
  const password = encodeURIComponent(process.env.RABBITMQ_PASSWORD || "");
  const auth = password ? `${username}:${password}@` : username ? `${username}@` : "";
  return `amqp://${auth}${host}:${port}`;
}

const EXCHANGE =
  process.env.RABBITMQ_EXCHANGE || "sanitigo.events";
const QUEUE = "sanitigo.booking.events";

const MAX_ATTEMPTS = 8;
const BASE_DELAY_MS = 5_000;
const MAX_DELAY_MS = 5 * 60_000;
const BATCH_SIZE = 50;

let connection;
let channel;
let publishing = false;
let isShuttingDown = false;
let activeBatchPromise = null;
const returnedMessageIds = new Set();

function retryDelayMs(attempt) {
  return Math.min(
    BASE_DELAY_MS * 2 ** Math.max(0, attempt - 1),
    MAX_DELAY_MS,
  );
}

async function ensureRabbitMQConnection() {
  if (channel) return channel;

  const amqpUrl = getRabbitMQUrl();
  if (!amqpUrl) {
    throw new Error("RabbitMQ connection is not configured (missing RABBITMQ_URL or RABBITMQ_HOST)");
  }

  connection = await amqp.connect(amqpUrl);

  connection.on("error", (error) => {
    logger.error(`[Outbox] RabbitMQ connection error: ${error.message}`);
  });

  connection.on("close", () => {
    channel = undefined;
    connection = undefined;
  });

  const confirmChannel = await connection.createConfirmChannel();

  confirmChannel.on("return", (message) => {
    const messageId = message.properties.messageId;
    if (messageId) returnedMessageIds.add(messageId);
  });

  await confirmChannel.assertExchange(EXCHANGE, "topic", {
    durable: true,
  });

  // The Java service owns queue declaration and binding.
  channel = confirmChannel;
  return channel;
}

function publishAndConfirm(activeChannel, event) {
  const payload = event.payload;
  const messageId = payload.eventId || event.id;

  return new Promise((resolve, reject) => {
    activeChannel.publish(
      EXCHANGE,
      event.eventType,
      Buffer.from(JSON.stringify(payload)),
      {
        persistent: true,
        mandatory: true,
        contentType: "application/json",
        messageId,
        type: event.eventType,
        timestamp: Date.now(),
      },
      (error) => {
        if (error) {
          reject(error);
          return;
        }

        if (returnedMessageIds.has(messageId)) {
          returnedMessageIds.delete(messageId);
          reject(
            new Error(
              `RabbitMQ returned unroutable event ${messageId}`,
            ),
          );
          return;
        }

        resolve();
      },
    );
  });
}

async function recordPublishFailure(event, error) {
  const attempts = event.attempts + 1;
  const permanentlyFailed = attempts >= MAX_ATTEMPTS;
  const nextAttemptAt = new Date(Date.now() + retryDelayMs(attempts));
  const failureReason = String(error?.message || error).slice(0, 2000);

  await prisma.outboxEvent.updateMany({
    where: {
      id: event.id,
      status: "PENDING",
      attempts: event.attempts,
    },
    data: {
      attempts,
      status: permanentlyFailed ? "FAILED" : "PENDING",
      nextAttemptAt,
      lastError: failureReason,
    },
  });

  const eventId = event.payload?.eventId || event.id;
  if (permanentlyFailed) {
    logger.error(
      `[Outbox:PermanentlyFailed] EventId=${eventId} OutboxId=${event.id} ` +
        `EventType=${event.eventType} TotalAttempts=${attempts}/${MAX_ATTEMPTS} ` +
        `FailureReason="${failureReason}"`
    );
  } else {
    logger.warn(
      `[Outbox:PublishRetryScheduled] EventId=${eventId} OutboxId=${event.id} ` +
        `EventType=${event.eventType} Attempt=${attempts}/${MAX_ATTEMPTS} ` +
        `NextAttemptAt=${nextAttemptAt.toISOString()} Reason="${failureReason}"`
    );
  }
}

async function publishOne(event) {
  const eventId = event.payload?.eventId || event.id;
  const currentAttempt = event.attempts + 1;

  // Atomic lease claim: prevent any concurrent publisher instance from claiming this event
  const leaseTime = new Date(Date.now() + 60_000);
  const claim = await prisma.outboxEvent.updateMany({
    where: {
      id: event.id,
      status: "PENDING",
      attempts: event.attempts,
      nextAttemptAt: { lte: new Date() },
    },
    data: {
      nextAttemptAt: leaseTime,
    },
  });

  if (claim.count === 0) {
    // Already claimed or modified by another worker instance
    return false;
  }

  logger.info(
    `[Outbox:Publishing] EventId=${eventId} OutboxId=${event.id} ` +
      `EventType=${event.eventType} Attempt=${currentAttempt}/${MAX_ATTEMPTS}`
  );

  try {
    const activeChannel = await ensureRabbitMQConnection();
    await publishAndConfirm(activeChannel, event);

    // Compare-and-set prevents overwriting a concurrently changed row.
    await prisma.outboxEvent.updateMany({
      where: {
        id: event.id,
        status: "PENDING",
      },
      data: {
        status: "PUBLISHED",
        attempts: { increment: 1 },
        publishedAt: new Date(),
        lastError: null,
      },
    });

    logger.info(
      `[Outbox:Published] EventId=${eventId} OutboxId=${event.id} ` +
        `EventType=${event.eventType} Status=PUBLISHED Attempts=${currentAttempt}`
    );

    return true;
  } catch (error) {
    try {
      await recordPublishFailure(event, error);
    } catch (databaseError) {
      logger.error(
        `[Outbox:DatabaseError] Could not record publication failure for ${event.id}: ${databaseError.message}`
      );
    }

    // Force a fresh connection on the next poll after a channel failure.
    if (channel && channel.connection) {
      try {
        await channel.close();
      } catch {
        // It may already be closed.
      }
    }

    channel = undefined;
    return false;
  }
}

export async function publishPendingOutboxEvents() {
  if (publishing || isShuttingDown) return 0;
  publishing = true;

  let publishedCount = 0;

  activeBatchPromise = (async () => {
    try {
      const events = await prisma.outboxEvent.findMany({
        where: {
          status: "PENDING",
          nextAttemptAt: { lte: new Date() },
        },
        orderBy: { createdAt: "asc" },
        take: BATCH_SIZE,
      });

      for (const event of events) {
        if (isShuttingDown) {
          logger.info("[Outbox] Graceful shutdown in progress; halting remaining event batch.");
          break;
        }
        const success = await publishOne(event);
        if (success) {
          publishedCount++;
        }
      }

      return publishedCount;
    } catch (error) {
      logger.error(`[Outbox] Poll failed: ${error.message}`);
      return publishedCount;
    } finally {
      publishing = false;
      activeBatchPromise = null;
    }
  })();

  return await activeBatchPromise;
}

export async function closeRabbitMQ(timeoutMs = 10000) {
  isShuttingDown = true;
  logger.info("[Outbox] Initiating RabbitMQ shutdown; awaiting completion of in-flight work...");

  if (activeBatchPromise) {
    const timeout = new Promise((resolve) => setTimeout(resolve, timeoutMs));
    await Promise.race([activeBatchPromise, timeout]);
  }

  const activeChannel = channel;
  const activeConnection = connection;

  channel = undefined;
  connection = undefined;

  if (activeChannel) {
    try {
      await activeChannel.close();
    } catch {
      // Already closed.
    }
  }

  if (activeConnection) {
    try {
      await activeConnection.close();
    } catch {
      // Already closed.
    }
  }

  logger.info("[Outbox] RabbitMQ connection cleanly closed.");
}

export default {
  publishPendingOutboxEvents,
  closeRabbitMQ,
};
