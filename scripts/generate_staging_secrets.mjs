#!/usr/bin/env node
import crypto from "crypto";

/**
 * SanitiGo Cryptographic Secrets Generator for Staging & Production
 * Generates high-entropy secrets using Node crypto.randomBytes
 */
function generateSecrets() {
  const jwtAccess = crypto.randomBytes(32).toString("hex");
  const jwtRefresh = crypto.randomBytes(32).toString("hex");
  const webhookSecret = "whsec_" + crypto.randomBytes(24).toString("hex");

  console.log("==================================================================");
  console.log("       SANITI-GO CLOUD STAGING CRYPTOGRAPHIC SECRETS              ");
  console.log("==================================================================\n");
  console.log("Paste the following secrets into your cloud provider's Secret Manager");
  console.log("(e.g., Render Environment Groups, Railway Variables, or AWS Secrets Manager):\n");

  console.log(`JWT_ACCESS_SECRET=${jwtAccess}`);
  console.log(`JWT_REFRESH_SECRET=${jwtRefresh}`);
  console.log(`PAYMENT_WEBHOOK_SECRET=${webhookSecret}`);
  console.log("\n------------------------------------------------------------------");
  console.log("All generated secrets exceed 32 characters and fulfill cryptographic entropy standards.");
  console.log("==================================================================");
}

generateSecrets();
