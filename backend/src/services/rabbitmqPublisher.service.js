import amqp from "amqplib";

import prisma from "../config/prisma.js";

const RABBITMQ_URL = process.env.RABBITMQ_URL;
const EXCHANGE =
  process.env.RABBITMQ_EXCHANGE || "sanitigo.events";

let connection;
let channel;
let publishing = false;

const connect = async () => {
  if (channel) {
    return channel;
  }

  if (!RABBITMQ_URL) {
    throw new Error("RABBITMQ_URL is not configured.");
  }

  connection = await amqp.connect(RABBITMQ_URL);

  connection.on("error", (error) => {
    console.error("[RabbitMQ] Connection error:", error.message);
    channel = undefined;
    connection = undefined;
  });

  connection.on("close", () => {
    channel = undefined;
    connection = undefined;
  });

  channel = await connection.createConfirmChannel();

  await channel.assertExchange(EXCHANGE, "topic", {
    durable: true,
  });

  await channel.assertQueue("sanitigo.booking.events", {
    durable: true,
  });

  await channel.bindQueue(
    "sanitigo.booking.events",
    EXCHANGE,
    "#"
  );

  return channel;
};

const publishEvent = async (event) => {
  const activeChannel = await connect();

  const routingKey = event.eventType;
  const body = Buffer.from(JSON.stringify(event.payload));

  await new Promise((resolve, reject) => {
    activeChannel.publish(
      EXCHANGE,
      routingKey,
      body,
      {
        persistent: true,
        contentType: "application/json",
        messageId: event.payload.eventId,
        type: event.eventType,
        timestamp: Date.now(),
      },
      (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      }
    );
  });
};

export const publishPendingOutboxEvents = async () => {
  // Prevent overlapping polling cycles in this process.
  if (publishing) {
    return 0;
  }

  publishing = true;

  let publishedCount = 0;

  try {
    const events = await prisma.outboxEvent.findMany({
      where: {
        status: "PENDING",
      },
      orderBy: {
        createdAt: "asc",
      },
      take: 50,
    });

    for (const event of events) {
      try {
        await publishEvent(event);

        await prisma.outboxEvent.updateMany({
          where: {
            id: event.id,
            status: "PENDING",
          },
          data: {
            status: "PUBLISHED",
            publishedAt: new Date(),
            attempts: {
              increment: 1,
            },
            lastError: null,
          },
        });

        publishedCount++;
      } catch (error) {
        console.error(
          `[Outbox] Failed to publish ${event.id}:`,
          error.message
        );

        await prisma.outboxEvent.updateMany({
          where: {
            id: event.id,
            status: "PENDING",
          },
          data: {
            attempts: {
              increment: 1,
            },
            lastError: error.message.slice(0, 2000),
          },
        });

        // Stop this batch when RabbitMQ is unavailable.
        // The pending records will be retried on the next poll.
        break;
      }
    }

    return publishedCount;
  } finally {
    publishing = false;
  }
};

export const closeRabbitMQ = async () => {
  const currentConnection = connection;

  channel = undefined;
  connection = undefined;

  if (currentConnection) {
    await currentConnection.close();
  }
};

export default {
  publishPendingOutboxEvents,
  closeRabbitMQ,
};
