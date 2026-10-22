import { randomUUID } from "node:crypto";

/**
 * Insert an event into the outbox using the caller's
 * existing Prisma transaction.
 *
 * The caller must commit the transaction for the event
 * to become visible to the publisher.
 */
export const recordOutboxEvent = async (
  tx,
  { eventType, aggregateId, data }
) => {
  const event = {
    eventId: randomUUID(),
    eventType,
    aggregateId,
    occurredAt: new Date().toISOString(),
    version: 1,
    data,
  };

  await tx.outboxEvent.create({
    data: {
      eventType,
      aggregateId,
      payload: event,
    },
  });

  return event;
};

export default {
  recordOutboxEvent,
};
