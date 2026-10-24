import logger from "./logger.js";

/**
 * Validates required environment variables on service startup.
 * Throws a descriptive Error and logs issues if configuration is invalid.
 */
export function validateEnv() {
  const errors = [];
  const isProd = process.env.NODE_ENV === "production";

  // 1. Core Server & Database Configuration
  if (!process.env.DATABASE_URL) {
    errors.push("DATABASE_URL is required.");
  } else if (
    !process.env.DATABASE_URL.startsWith("postgresql://") &&
    !process.env.DATABASE_URL.startsWith("postgres://")
  ) {
    errors.push("DATABASE_URL must be a valid PostgreSQL connection URI.");
  }

  if (!process.env.JWT_ACCESS_SECRET) {
    errors.push("JWT_ACCESS_SECRET is required.");
  } else if (process.env.JWT_ACCESS_SECRET.length < 32) {
    errors.push("JWT_ACCESS_SECRET must be at least 32 characters long for cryptographic security.");
  }

  if (!process.env.JWT_REFRESH_SECRET) {
    errors.push("JWT_REFRESH_SECRET is required.");
  } else if (process.env.JWT_REFRESH_SECRET.length < 32) {
    errors.push("JWT_REFRESH_SECRET must be at least 32 characters long for cryptographic security.");
  }

  // 2. Messaging Configuration
  const hasRabbitMQ =
    Boolean(process.env.RABBITMQ_URL) ||
    Boolean(process.env.RABBITMQ_HOST && process.env.RABBITMQ_USERNAME);

  if (!hasRabbitMQ) {
    errors.push(
      "RabbitMQ connection must be configured via RABBITMQ_URL or (RABBITMQ_HOST, RABBITMQ_USERNAME, RABBITMQ_PASSWORD)."
    );
  }

  // 3. Production Configuration Safeguards
  if (isProd) {
    if (process.env.PAYMENT_MODE === "mock") {
      errors.push("PAYMENT_MODE='mock' is strictly prohibited in production.");
    }
  }

  if (errors.length > 0) {
    const errorMsg =
      "[Startup Configuration Error] The following configuration checks failed:\n" +
      errors.map((e) => `  * ${e}`).join("\n");

    if (logger && typeof logger.error === "function") {
      logger.error(errorMsg);
    } else {
      console.error(errorMsg);
    }

    throw new Error(errorMsg);
  }

  return true;
}

export default validateEnv;
