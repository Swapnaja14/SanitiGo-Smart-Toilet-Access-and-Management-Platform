import dotenv from "dotenv";
dotenv.config();

import { validateEnv } from "./config/envValidator.js";
validateEnv();

import app from "./app.js";
import logger from "./config/logger.js";
import prisma from "./config/prisma.js";
import { startBookingExpiryJob } from "./jobs/bookingExpiry.job.js";
import { startOutboxPublisher } from "./jobs/outboxPublisher.job.js";
import { startOperationalMonitor } from "./jobs/operationalMonitor.job.js";
import { closeRabbitMQ } from "./services/rabbitmqPublisher.service.js";

const PORT = process.env.PORT || 5000;

const bookingExpiryTask = startBookingExpiryJob();
const outboxPublisherTask = startOutboxPublisher();
const operationalMonitorTask = startOperationalMonitor();

const server = app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
});

let isShuttingDown = false;

const shutdown = async (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info(`Graceful shutdown initiated (${signal})...`);

    // Safety watchdog timer (15 seconds) to prevent hung process
    const forceExitTimer = setTimeout(() => {
        logger.error("Graceful shutdown timed out after 15s. Forcing exit.");
        process.exit(1);
    }, 15000);
    forceExitTimer.unref();

    // 1. Stop accepting new HTTP requests
    server.close(() => {
        logger.info("HTTP server closed to new connections.");
    });

    // 2. Stop scheduled cron jobs
    try {
        outboxPublisherTask?.stop();
        bookingExpiryTask?.stop();
        operationalMonitorTask?.stop();
        logger.info("Background cron tasks stopped.");
    } catch (err) {
        logger.error(`Error stopping cron tasks: ${err.message}`);
    }

    // 3. Drain and wait for in-flight outbox publishing work, then close RabbitMQ
    try {
        await closeRabbitMQ(8000);
    } catch (error) {
        logger.error(`RabbitMQ shutdown error: ${error.message}`);
    }

    // 4. Disconnect Prisma client
    try {
        await prisma.$disconnect();
        logger.info("Prisma database connection pool disconnected.");
    } catch (error) {
        logger.error(`Database disconnect error: ${error.message}`);
    }

    logger.info("Graceful shutdown completed successfully.");
    clearTimeout(forceExitTimer);
    process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));