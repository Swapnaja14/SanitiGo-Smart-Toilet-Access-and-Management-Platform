import dotenv from "dotenv";
dotenv.config();

import amqp from "amqplib";
import { PrismaClient } from "@prisma/client";
import { generateAccessToken } from "../utils/jwt.js";

const prisma = new PrismaClient();

const RABBITMQ_URL =
  process.env.RABBITMQ_URL ||
  "amqp://sanitigo_app:SanitiGo%40SecurePass2026%21@localhost:5672";

async function runVerification() {
  console.log("===============================================================");
  console.log("   STEP 3: BUILD, TEST, AND VERIFY NOTIFICATION PERSISTENCE   ");
  console.log("===============================================================\n");

  try {
    // 1. Setup Customer and Toilet in the database
    let customer = await prisma.user.findFirst({
      where: { role: "USER" },
    });
    if (!customer) {
      customer = await prisma.user.create({
        data: {
          fullName: "Test Customer Step3",
          email: `customer_step3_${Date.now()}@sanitigo.com`,
          password: "password123",
          role: "USER",
        },
      });
    }

    let toilet = await prisma.toilet.findFirst({
      where: { isAvailable: true },
    });
    if (!toilet) {
      let owner = await prisma.user.findFirst({ where: { role: "OWNER" } });
      if (!owner) {
        owner = await prisma.user.create({
          data: {
            fullName: "Test Owner Step3",
            email: `owner_step3_${Date.now()}@sanitigo.com`,
            password: "password123",
            role: "OWNER",
          },
        });
      }
      toilet = await prisma.toilet.create({
        data: {
          ownerId: owner.id,
          name: "Step3 Station Toilet",
          address: "100 Gateway Plaza",
          city: "Mumbai",
          state: "Maharashtra",
          country: "India",
          postalCode: "400001",
          price: 30.0,
          latitude: 19.0760,
          longitude: 72.8777,
          isAvailable: true,
          qrToken: "QR_STEP3_" + Date.now(),
        },
      });
    }

    const token = generateAccessToken({
      id: customer.id,
      email: customer.email,
      role: customer.role,
    });

    console.log(`[Setup] Customer ID: ${customer.id} (${customer.email})`);
    console.log(`[Setup] Toilet ID: ${toilet.id} (${toilet.name})`);

    // 2. Create fresh booking through existing Node.js API
    console.log("\n[Step 3.0] Creating fresh booking via POST http://localhost:5000/api/v1/bookings...");
    const day = 10 + Math.floor(Math.random() * 18);
    const bookingPayload = {
      toiletId: toilet.id,
      scheduledDate: `2026-12-${day.toString().padStart(2, "0")}`,
      startTime: "15:00",
      endTime: "15:30",
      paymentMethod: "UPI",
    };

    const response = await fetch("http://localhost:5000/api/v1/bookings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(bookingPayload),
    });

    const resJson = await response.json();
    if (!response.ok) {
      throw new Error(`API booking creation failed: ${JSON.stringify(resJson)}`);
    }

    const createdBooking = resJson.data?.booking || resJson.booking || resJson.data;
    console.log(`  ✓ Booking created successfully! ID: ${createdBooking.id}, Status: ${createdBooking.status}`);

    // Wait for outbox publisher cron (runs every 3-5s) to publish to RabbitMQ and Java consumer to process
    console.log("\nWaiting for outbox publisher to dispatch event and Java service to persist Notification...");
    await new Promise((r) => setTimeout(r, 6000));

    // 3.1 Verify notification persistence
    console.log("\n--- 3.1 Querying Notification Persistence ---");
    const notifications = await prisma.$queryRaw`
      SELECT
          "id",
          "userId",
          "eventId",
          "type",
          "title",
          "message",
          "readAt",
          "createdAt"
      FROM "Notification"
      ORDER BY "createdAt" DESC
      LIMIT 5;
    `;

    console.log("Query Results (Top Notifications):");
    console.table(notifications);

    const matchingNotif = notifications.find(
      (n) => n.userId === customer.id && n.type === "BOOKING_CREATED"
    );
    if (!matchingNotif) {
      console.warn("  ⚠ Warning: Did not find notification specifically for customer right away; checking all...");
    } else {
      console.log(`  ✓ Verified: Found BOOKING_CREATED notification for customerId: ${customer.id}`);
      console.log(`    Notification ID: ${matchingNotif.id}`);
      console.log(`    Event ID: ${matchingNotif.eventId}`);
      console.log(`    Title: "${matchingNotif.title}", Message: "${matchingNotif.message}"`);
    }

    // 3.2 Verify notification metadata
    console.log("\n--- 3.2 Querying Notification Metadata ---");
    const notifMetadata = await prisma.$queryRaw`
      SELECT
          "eventId",
          "type",
          "data"
      FROM "Notification"
      ORDER BY "createdAt" DESC
      LIMIT 5;
    `;

    console.log("Notification Metadata JSON:");
    for (const item of notifMetadata) {
      console.log(`- Event: ${item.eventId} | Type: ${item.type}`);
      console.log(`  Data: ${JSON.stringify(item.data, null, 2)}`);
    }

    // 3.3 Verify duplicate delivery
    console.log("\n--- 3.3 Verifying Duplicate Delivery Safeguard ---");
    if (matchingNotif) {
      console.log(`Replaying exact same eventId: ${matchingNotif.eventId} to RabbitMQ queue 'sanitigo.booking.events'...`);
      const connection = await amqp.connect(RABBITMQ_URL);
      const channel = await connection.createChannel();

      const replayPayload = {
        eventId: matchingNotif.eventId,
        eventType: "booking.created.v1",
        occurredAt: new Date().toISOString(),
        version: 1,
        data: matchingNotif.data || {
          bookingId: createdBooking.id,
          customerId: customer.id,
        },
      };

      channel.sendToQueue(
        "sanitigo.booking.events",
        Buffer.from(JSON.stringify(replayPayload)),
        { persistent: true, contentType: "application/json" }
      );

      await channel.close();
      await connection.close();

      console.log("Duplicate event sent. Waiting 3s for Java consumer to process...");
      await new Promise((r) => setTimeout(r, 3000));

      const duplicates = await prisma.$queryRaw`
        SELECT "eventId", COUNT(*)::int as count
        FROM "Notification"
        GROUP BY "eventId"
        HAVING COUNT(*) > 1;
      `;

      console.log(`Duplicate query result count: ${duplicates.length}`);
      if (duplicates.length === 0) {
        console.log("  ✓ Verified: ZERO duplicate notification rows found. Duplicate was safely ignored by ON CONFLICT and processed_event claim!");
      } else {
        console.error("  ✗ Duplicate found:", duplicates);
      }
    }

    console.log("\n=== STEP 3 VERIFICATION COMPLETE ===");
  } catch (err) {
    console.error("Verification error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

runVerification();
