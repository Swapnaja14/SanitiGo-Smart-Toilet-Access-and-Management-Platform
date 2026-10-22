import cron from "node-cron";

import {
  publishPendingOutboxEvents,
} from "../services/rabbitmqPublisher.service.js";

export const startOutboxPublisher = () => {
  return cron.schedule("*/5 * * * * *", async () => {
    try {
      const count = await publishPendingOutboxEvents();

      if (count > 0) {
        console.info(`[Outbox] Published ${count} event(s).`);
      }
    } catch (error) {
      console.error("[Outbox] Publisher failed:", error.message);
    }
  });
};

export default {
  startOutboxPublisher,
};
