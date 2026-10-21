import dotenv from "dotenv";
import app from "./app.js";
import logger from "./config/logger.js";
import { startBookingExpiryJob } from "./jobs/bookingExpiry.job.js";

dotenv.config();

const PORT = process.env.PORT || 5000;

const bookingExpiryTask = startBookingExpiryJob();

app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
});