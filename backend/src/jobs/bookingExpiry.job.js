import cron from "node-cron";

import { expireBookings } from "../services/bookingExpiry.service.js";

export const startBookingExpiryJob = () => {
  // Run once every minute.
  return cron.schedule("* * * * *", async () => {
    try {
      const expiredCount = await expireBookings();

      if (expiredCount > 0) {
        console.info(
          `[BookingExpiry] Expired ${expiredCount} booking(s).`
        );
      }
    } catch (error) {
      console.error(
        "[BookingExpiry] Job failed:",
        error
      );
    }
  });
};

export default {
  startBookingExpiryJob,
};
