import amqp from "amqplib";
import prisma from "../config/prisma.js";

const RABBITMQ_URL = process.env.RABBITMQ_URL;
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
const returnedMessageIds = new Set();

function retryDelayMs(attempt) {
  return Math.min(
    BASE_DELAY_MS * 2 ** Math.max(0, attempt - 1),
    MAX_DELAY_MS,
  );
}

async function ensureRabbitMQConnection() {
  if (channel) return channel;

  if (!RABBITMQ_URL) {
    throw new Error("RABBITMQ_URL is not configured");
  }

  connection = await amqp.connect(RABBITMQ_URL);

  connection.on("error", (error) => {
    console.error("[Outbox] RabbitMQ connection error:", error.message);
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

  await confirmChannel.assertQueue(QUEUE, {
    durable: true,
  });

  await confirmChannel.bindQueue(QUEUE, EXCHANGE, "#");

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

  await prisma.outboxEvent.updateMany({
    where: {
      id: event.id,
      status: "PENDING",
      attempts: event.attempts,
    },
    data: {
      attempts,
      status: permanentlyFailed ? "FAILED" : "PENDING",
      nextAttemptAt: new Date(
        Date.now() + retryDelayMs(attempts),
      ),
      lastError: String(error?.message || error).slice(0, 2000),
    },
  });

  console.error(
    `[Outbox] ${event.id} publication failed; ` +
      `attempt ${attempts}/${MAX_ATTEMPTS}; ` +
      `status=${permanentlyFailed ? "FAILED" : "PENDING"}`,
  );
}

async function publishOne(event) {
  try {
    const activeChannel = await ensureRabbitMQConnection();
    await publishAndConfirm(activeChannel, event);

    // Compare-and-set prevents overwriting a concurrently changed row.
    await prisma.outboxEvent.updateMany({
      where: {
        id: event.id,
        status: "PENDING",
        attempts: event.attempts,
      },
      data: {
        status: "PUBLISHED",
        attempts: { increment: 1 },
        publishedAt: new Date(),
        lastError: null,
      },
    });

    return true;
  } catch (error) {
    try {
      await recordPublishFailure(event, error);
    } catch (databaseError) {
      console.error(
        "[Outbox] Could not record publication failure:",
        databaseError.message,
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
  if (publishing) return 0;
  publishing = true;

  let publishedCount = 0;

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
      const success = await publishOne(event);
      if (success) {
        publishedCount++;
      }
    }

    return publishedCount;
  } catch (error) {
    console.error(
      "[Outbox] Poll failed:",
      error.message,
    );
    return publishedCount;
  } finally {
    publishing = false;
  }
}

export async function closeRabbitMQ() {
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
}

export default {
  publishPendingOutboxEvents,
  closeRabbitMQ,
};
