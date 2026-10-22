import amqp from "amqplib";
import logger from "../config/logger.js";

const RABBITMQ_URL =
  process.env.RABBITMQ_URL ||
  (process.env.RABBITMQ_HOST
    ? `amqp://${encodeURIComponent(process.env.RABBITMQ_USERNAME || "sanitigo_app")}:${encodeURIComponent(process.env.RABBITMQ_PASSWORD || "")}@${process.env.RABBITMQ_HOST}:${process.env.RABBITMQ_PORT || 5672}`
    : "amqp://sanitigo_app:SanitiGo%40SecurePass2026%21@localhost:5672");

const EXCHANGE = process.env.RABBITMQ_EXCHANGE || "sanitigo.events";
const DLQ_QUEUE = "sanitigo.booking.events.dlq";
const MAIN_QUEUE = "sanitigo.booking.events";

/**
 * Returns a fresh AMQP channel for DLQ management tasks.
 */
async function getChannel() {
  const connection = await amqp.connect(RABBITMQ_URL);
  const channel = await connection.createConfirmChannel();
  return { connection, channel };
}

/**
 * Get current message count in the Dead-Letter Queue.
 */
export async function getDLQDepth() {
  let conn, ch;
  try {
    const res = await getChannel();
    conn = res.connection;
    ch = res.channel;

    const q = await ch.checkQueue(DLQ_QUEUE);
    return q.messageCount;
  } catch (error) {
    logger.warn(`[DLQ] Failed to check DLQ depth: ${error.message}`);
    return 0;
  } finally {
    if (ch) await ch.close().catch(() => {});
    if (conn) await conn.close().catch(() => {});
  }
}

/**
 * Non-destructively peek up to `limit` messages from the DLQ.
 * Messages are retrieved and immediately nack'd with requeue: true.
 */
export async function peekDLQMessages(limit = 10) {
  let conn, ch;
  const messages = [];

  try {
    const res = await getChannel();
    conn = res.connection;
    ch = res.channel;

    for (let i = 0; i < limit; i++) {
      const msg = await ch.get(DLQ_QUEUE, { noAck: false });
      if (!msg) break;

      let parsedContent;
      try {
        parsedContent = JSON.parse(msg.content.toString("utf8"));
      } catch {
        parsedContent = msg.content.toString("utf8");
      }

      messages.push({
        messageId: msg.properties.messageId,
        headers: msg.properties.headers,
        timestamp: msg.properties.timestamp,
        content: parsedContent,
      });

      // Requeue immediately so the message is not lost
      ch.nack(msg, false, true);
    }

    return messages;
  } finally {
    if (ch) await ch.close().catch(() => {});
    if (conn) await conn.close().catch(() => {});
  }
}

/**
 * Controlled replay procedure:
 * Reads messages from the DLQ and republishes them to the primary exchange.
 * Only acks the message from the DLQ once the main exchange confirms publication.
 *
 * @param {number} limit Maximum number of messages to replay in this run.
 * @returns {Promise<{ replayedCount: number, errors: string[] }>}
 */
export async function replayDLQMessages(limit = 50) {
  let conn, ch;
  let replayedCount = 0;
  const errors = [];

  try {
    const res = await getChannel();
    conn = res.connection;
    ch = res.channel;

    logger.info(`[DLQ Replay] Starting controlled replay for up to ${limit} message(s)...`);

    for (let i = 0; i < limit; i++) {
      const msg = await ch.get(DLQ_QUEUE, { noAck: false });
      if (!msg) break;

      try {
        let payload;
        try {
          payload = JSON.parse(msg.content.toString("utf8"));
        } catch {
          payload = msg.content;
        }

        const eventType =
          payload.eventType ||
          msg.properties.type ||
          "booking.events";

        const messageId =
          msg.properties.messageId ||
          payload.eventId ||
          `replay-${Date.now()}`;

        // Republish to main exchange
        await new Promise((resolve, reject) => {
          ch.publish(
            EXCHANGE,
            eventType,
            msg.content,
            {
              persistent: true,
              contentType: msg.properties.contentType || "application/json",
              messageId,
              type: eventType,
              headers: {
                ...msg.properties.headers,
                replayedAt: new Date().toISOString(),
                replayedFrom: DLQ_QUEUE,
              },
            },
            (err) => {
              if (err) return reject(err);
              resolve();
            }
          );
        });

        // Acknowledge from DLQ after confirm
        ch.ack(msg);
        replayedCount++;
        logger.info(`[DLQ Replay] Successfully replayed message: ${messageId} (${eventType})`);
      } catch (err) {
        // If republish fails, requeue back in DLQ
        ch.nack(msg, false, true);
        const errMsg = `Failed to replay message: ${err.message}`;
        logger.error(`[DLQ Replay] ${errMsg}`);
        errors.push(errMsg);
      }
    }

    logger.info(`[DLQ Replay] Completed: ${replayedCount} message(s) replayed, ${errors.length} error(s).`);
    return { replayedCount, errors };
  } finally {
    if (ch) await ch.close().catch(() => {});
    if (conn) await conn.close().catch(() => {});
  }
}

/**
 * Purge all messages from the DLQ.
 */
export async function purgeDLQ() {
  let conn, ch;
  try {
    const res = await getChannel();
    conn = res.connection;
    ch = res.channel;

    const result = await ch.purgeQueue(DLQ_QUEUE);
    logger.warn(`[DLQ] Purged ${result.messageCount} message(s) from ${DLQ_QUEUE}`);
    return result.messageCount;
  } finally {
    if (ch) await ch.close().catch(() => {});
    if (conn) await conn.close().catch(() => {});
  }
}

export default {
  getDLQDepth,
  peekDLQMessages,
  replayDLQMessages,
  purgeDLQ,
};
