import dotenv from "dotenv";
import app from "./app.js";
import logger from "./config/logger.js";
import prisma from "./config/prisma.js";
import { startBookingExpiryJob } from "./jobs/bookingExpiry.job.js";
import { startOutboxPublisher } from "./jobs/outboxPublisher.job.js";
import { closeRabbitMQ } from "./services/rabbitmqPublisher.service.js";

dotenv.config();

const PORT = process.env.PORT || 5000;

const bookingExpiryTask = startBookingExpiryJob();
const outboxPublisherTask = startOutboxPublisher();

const server = app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
});

const shutdown = async () => {
    logger.info("Graceful shutdown initiated...");
    outboxPublisherTask.stop();
    bookingExpiryTask.stop();

    try {
        await closeRabbitMQ();
    } catch (error) {
        logger.error("RabbitMQ shutdown error:", error.message);
    }

    await prisma.$disconnect();
    server.close(() => {
        process.exit(0);
    });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);