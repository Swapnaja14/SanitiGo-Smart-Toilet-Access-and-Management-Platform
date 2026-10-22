import dotenv from "dotenv";
dotenv.config();

import prisma from "../src/config/prisma.js";
import { generateAccessToken } from "../utils/jwt.js";
import http from "node:http";
import amqp from "amqplib";
import { execSync } from "node:child_process";

const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://sanitigo_app:SanitiGo%40SecurePass2026%21@localhost:5672";
const EXCHANGE = process.env.RABBITMQ_EXCHANGE || "sanitigo.events";

function queryPostgres(sql) {
  const sanitized = sql.replace(/"/g, '\\"').replace(/\n/g, " ");
  const cmd = `docker exec sanitigo-postgres psql -U postgres -d sanitigo_test -t -A -c "${sanitized}"`;
  const output = execSync(cmd, { encoding: "utf8" }).trim();
  if (!output) return [];
  return output.split("\n").map((line) => line.split("|"));
}

async function main() {
  console.log("=== PHASE 5.11.3 VERIFICATION SEQUENCE ===");

  // 1. Setup User and Toilet in Neon DB
  console.log("\n--- Step 1: Finding or preparing User & Toilet ---");
  let user = await prisma.user.findFirst({
    where: { role: "USER" },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        fullName: "Verification Customer",
        email: `verify_user_${Date.now()}@example.com`,
        password: "hashedPassword123",
        role: "USER",
      },
    });
  }

  let owner = await prisma.user.findFirst({
    where: { role: "OWNER" },
  });

  if (!owner) {
    owner = await prisma.user.create({
      data: {
        fullName: "Verification Owner",
        email: `verify_owner_${Date.now()}@example.com`,
        password: "hashedPassword123",
        role: "OWNER",
      },
    });
  }

  let toilet = await prisma.toilet.findFirst({
    where: { isAvailable: true },
  });

  if (!toilet) {
    toilet = await prisma.toilet.create({
      data: {
        ownerId: owner.id,
        name: "Verification Smart Restroom",
        address: "742 Evergreen Terrace",
        city: "Mumbai",
        state: "Maharashtra",
        country: "India",
        postalCode: "400001",
        price: 30.0,
        latitude: 18.9696,
        longitude: 72.8194,
        qrToken: "QR_VERIFY_" + Date.now(),
        isAvailable: true,
      },
    });
  }

  // Ensure operating hours exist for the toilet
  const days = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
  for (const day of days) {
    await prisma.operatingHours.upsert({
      where: { toiletId_day: { toiletId: toilet.id, day } },
      update: { isClosed: false, openingTime: "06:00", closingTime: "22:00" },
      create: { toiletId: toilet.id, day, isClosed: false, openingTime: "06:00", closingTime: "22:00" },
    });
  }

  console.log(`User ID: ${user.id}, Toilet ID: ${toilet.id}`);

  const token = generateAccessToken({
    id: user.id,
    role: user.role,
    email: user.email,
  });

  // 2. Create Booking via API
  console.log("\n--- Step 2: Creating a booking via POST /api/bookings ---");
  const randomDay = 10 + Math.floor(Math.random() * 15);
  const scheduledDate = `2026-12-${randomDay}`;
  const randomHour = 10 + Math.floor(Math.random() * 8);
  const startTime = `${String(randomHour).padStart(2, "0")}:00`;
  const endTime = `${String(randomHour).padStart(2, "0")}:30`;

  const postData = JSON.stringify({
    toiletId: toilet.id,
    scheduledDate,
    startTime,
    endTime,
    paymentMethod: "UPI",
  });

  const bookingRes = await new Promise((resolve, reject) => {
    const req = http.request(
      "http://localhost:5000/api/bookings",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Content-Length": Buffer.byteLength(postData),
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(body) });
          } catch (e) {
            resolve({ status: res.statusCode, body });
          }
        });
      }
    );
    req.on("error", reject);
    req.write(postData);
    req.end();
  });

  console.log("POST /api/bookings HTTP Status:", bookingRes.status);
  const bookingId = bookingRes.body?.data?.id;
  if (!bookingId) {
    console.error("Booking creation failed:", bookingRes.body);
    process.exit(1);
  }
  console.log("Created Booking ID:", bookingId);

  // 3. Confirm Outbox Event and publication
  console.log("\n--- Step 3: Waiting for Outbox publisher to deliver booking.created.v1 ---");
  let publishedOutbox = null;
  for (let i = 0; i < 15; i++) {
    const events = await prisma.outboxEvent.findMany({
      where: { aggregateId: bookingId, eventType: "booking.created.v1" },
    });
    if (events.length > 0 && events[0].status === "PUBLISHED") {
      publishedOutbox = events[0];
      break;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  if (!publishedOutbox) {
    console.error("Outbox event was not marked PUBLISHED in time!");
    process.exit(1);
  }
  console.log("Outbox Event published successfully:", {
    id: publishedOutbox.id,
    eventType: publishedOutbox.eventType,
    status: publishedOutbox.status,
    publishedAt: publishedOutbox.publishedAt,
  });

  const payloadObj = typeof publishedOutbox.payload === "string"
    ? JSON.parse(publishedOutbox.payload)
    : publishedOutbox.payload;

  const eventId = payloadObj.eventId;
  console.log("Extracted payload eventId:", eventId);

  // 4. Check Java consumer processed the event in PostgreSQL processed_event
  console.log("\n--- Step 4: Verifying processed_event table in PostgreSQL ---");
  // Give consumer a moment to commit
  await new Promise((r) => setTimeout(r, 2000));

  const initialRows = queryPostgres(
    `SELECT event_id, event_type, processed_at FROM processed_event WHERE event_id = '${eventId}';`
  );
  console.log("processed_event records for eventId:", initialRows);
  if (initialRows.length !== 1) {
    console.error(`Expected exactly 1 row, found ${initialRows.length}`);
    process.exit(1);
  }
  console.log("SUCCESS: Exactly one row found for valid event!");

  // 5. Duplicate test: Replay the exact same message with the same eventId
  console.log("\n--- Step 5: Testing duplicate delivery by replaying the exact same message ---");
  const conn = await amqp.connect(RABBITMQ_URL);
  const ch = await conn.createChannel();

  const rawPayload = typeof publishedOutbox.payload === "string" 
    ? publishedOutbox.payload 
    : JSON.stringify(publishedOutbox.payload);

  console.log("Re-publishing message to exchange with same eventId:", eventId);
  ch.publish(
    EXCHANGE,
    "booking.events",
    Buffer.from(rawPayload),
    {
      contentType: "application/json",
      messageId: eventId,
      persistent: true,
    }
  );

  await new Promise((r) => setTimeout(r, 2000));

  // Check duplicate counts
  const dupCheck = queryPostgres(`
    SELECT event_id, event_type, COUNT(*) as cnt
    FROM processed_event
    GROUP BY event_id, event_type
    HAVING COUNT(*) > 1;
  `);
  console.log("Duplicate check query result (HAVING COUNT(*) > 1):", dupCheck);
  if (dupCheck.length > 0) {
    console.error("FAIL: Duplicate records found in processed_event!");
    process.exit(1);
  }

  const postDupRows = queryPostgres(
    `SELECT event_id, event_type, processed_at FROM processed_event WHERE event_id = '${eventId}';`
  );
  console.log("processed_event inspection after duplicate replay:", postDupRows);
  if (postDupRows.length !== 1) {
    console.error(`Expected exactly 1 row after replay, found ${postDupRows.length}`);
    process.exit(1);
  }
  console.log("SUCCESS: Replayed duplicate was safely ignored, still exactly one row!");

  // 6. Test unsupported event type routed to DLQ
  console.log("\n--- Step 6: Testing unsupported event type & DLQ routing ---");
  const unsupportedEventId = "dlq-verify-" + Date.now();
  const unsupportedPayload = {
    eventId: unsupportedEventId,
    eventType: "invalid.test.v1",
    occurredAt: new Date().toISOString(),
    version: 1,
    data: { foo: "bar" },
  };

  console.log("Publishing unsupported event:", unsupportedEventId);
  ch.publish(
    EXCHANGE,
    "booking.events",
    Buffer.from(JSON.stringify(unsupportedPayload)),
    {
      contentType: "application/json",
      messageId: unsupportedEventId,
      persistent: true,
    }
  );

  console.log("Waiting for Spring retries (3 attempts with backoff) to exhaust and route to DLQ...");
  const dlqQueue = "sanitigo.booking.events.dlq";
  let dlqMsg = null;

  for (let attempt = 0; attempt < 12; attempt++) {
    await new Promise((r) => setTimeout(r, 1000));
    dlqMsg = await ch.get(dlqQueue, { noAck: false });
    if (dlqMsg) {
      break;
    }
  }

  console.log("DLQ message inspection:", dlqMsg ? JSON.parse(dlqMsg.content.toString()) : "No message in DLQ");
  if (!dlqMsg) {
    console.error("FAIL: Message did not arrive in DLQ!");
    process.exit(1);
  }
  ch.ack(dlqMsg); // Clean up DLQ message

  // Verify NO row committed for unsupported event
  const unsupportedDbCheck = queryPostgres(
    `SELECT event_id FROM processed_event WHERE event_id = '${unsupportedEventId}';`
  );
  console.log("processed_event records for unsupported event:", unsupportedDbCheck);
  if (unsupportedDbCheck.length !== 0) {
    console.error("FAIL: Unsupported event created a record in processed_event!");
    process.exit(1);
  }
  console.log("SUCCESS: Unsupported event was retried, dead-lettered, and left 0 records in processed_event!");

  await ch.close();
  await conn.close();
  await prisma.$disconnect();

  console.log("\n=== ALL VERIFICATION CHECKS PASSED SUCCESSFULLY ===");
}

main().catch((err) => {
  console.error("Verification script encountered an error:", err);
  process.exit(1);
});
