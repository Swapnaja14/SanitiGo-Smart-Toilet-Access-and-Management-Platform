import request from "supertest";
import app from "../src/app.js";
import prisma from "../src/config/prisma.js";
import { generateAccessToken } from "../utils/jwt.js";
import crypto from "crypto";

async function runTests() {
  console.log("====================================================");
  console.log("   STEP 6: TESTING ALL FOUR NOTIFICATION ENDPOINTS   ");
  console.log("====================================================\n");

  let testUser;
  let testNotification;

  try {
    // 1. Find or create a test customer
    testUser = await prisma.user.findFirst({
      where: { role: "USER", isActive: true },
    });

    if (!testUser) {
      testUser = await prisma.user.create({
        data: {
          fullName: "Test Customer Notifications",
          email: `customer_notif_${Date.now()}@example.com`,
          password: "password123",
          role: "USER",
          isVerified: true,
          isActive: true,
        },
      });
    }

    const token = generateAccessToken({
      id: testUser.id,
      email: testUser.email,
      role: testUser.role,
    });

    console.log(`Using Customer ID: ${testUser.id} (${testUser.email})`);

    // Ensure at least one unread notification exists for this user
    testNotification = await prisma.notification.create({
      data: {
        userId: testUser.id,
        eventId: crypto.randomUUID(),
        type: "BOOKING_CREATED",
        title: "Booking created",
        message: "Your SanitiGo booking has been created.",
        data: {
          bookingId: "test-booking-" + Date.now(),
          customerId: testUser.id,
        },
        readAt: null,
      },
    });

    console.log(`Created test notification ID: ${testNotification.id}\n`);

    // -------------------------------------------------------------------------
    // Test A: List notifications
    // GET /api/notifications?page=1&limit=20
    // -------------------------------------------------------------------------
    console.log("--- Test A — List notifications ---");
    console.log("GET /api/notifications?page=1&limit=20");
    const resA = await request(app)
      .get("/api/notifications?page=1&limit=20")
      .set("Authorization", `Bearer ${token}`);

    console.log(`Status: ${resA.status}`);
    console.log("Response Body:", JSON.stringify(resA.body, null, 2));

    if (resA.status !== 200 || !resA.body.success) {
      throw new Error(`Test A failed with status ${resA.status}`);
    }
    console.log("✓ Test A Passed!\n");

    // -------------------------------------------------------------------------
    // Test B: Unread notification count
    // GET /api/notifications/unread-count
    // -------------------------------------------------------------------------
    console.log("--- Test B — Unread count ---");
    console.log("GET /api/notifications/unread-count");
    const resB = await request(app)
      .get("/api/notifications/unread-count")
      .set("Authorization", `Bearer ${token}`);

    console.log(`Status: ${resB.status}`);
    console.log("Response Body:", JSON.stringify(resB.body, null, 2));

    if (resB.status !== 200 || !resB.body.success || typeof resB.body.data.unreadCount !== "number") {
      throw new Error(`Test B failed with status ${resB.status}`);
    }
    console.log("✓ Test B Passed!\n");

    // -------------------------------------------------------------------------
    // Test C: Mark single notification as read
    // PATCH /api/notifications/:notificationId/read
    // -------------------------------------------------------------------------
    console.log("--- Test C — Mark notification as read ---");
    console.log(`PATCH /api/notifications/${testNotification.id}/read`);
    const resC = await request(app)
      .patch(`/api/notifications/${testNotification.id}/read`)
      .set("Authorization", `Bearer ${token}`);

    console.log(`Status: ${resC.status}`);
    console.log("Response Body:", JSON.stringify(resC.body, null, 2));

    if (resC.status !== 200 || !resC.body.success || !resC.body.data.notification.readAt) {
      throw new Error(`Test C failed with status ${resC.status}`);
    }
    console.log("✓ Test C Passed!\n");

    // -------------------------------------------------------------------------
    // Test D: Mark all notifications as read
    // PATCH /api/notifications/read-all
    // -------------------------------------------------------------------------
    // Create another unread notification first so there's something to mark read
    const anotherNotif = await prisma.notification.create({
      data: {
        userId: testUser.id,
        eventId: crypto.randomUUID(),
        type: "PAYMENT_SUCCEEDED",
        title: "Payment succeeded",
        message: "Your payment of ₹30.00 was successful.",
        data: {
          bookingId: "test-booking-" + Date.now(),
          amount: 30,
        },
        readAt: null,
      },
    });

    console.log("--- Test D — Mark all notifications as read ---");
    console.log("PATCH /api/notifications/read-all");
    const resD = await request(app)
      .patch("/api/notifications/read-all")
      .set("Authorization", `Bearer ${token}`);

    console.log(`Status: ${resD.status}`);
    console.log("Response Body:", JSON.stringify(resD.body, null, 2));

    if (resD.status !== 200 || !resD.body.success || typeof resD.body.data.updatedCount !== "number") {
      throw new Error(`Test D failed with status ${resD.status}`);
    }
    console.log("✓ Test D Passed!\n");

    console.log("====================================================");
    console.log("   ALL 4 NOTIFICATION ENDPOINTS TESTED SUCCESSFULLY! ");
    console.log("====================================================");
  } catch (error) {
    console.error("Test execution failed:", error);
    process.exit(1);
  } finally {
    // Clean up created test notifications
    if (testNotification) {
      await prisma.notification.deleteMany({
        where: {
          userId: testUser?.id,
          eventId: { in: [testNotification.eventId] },
        },
      });
    }
    await prisma.$disconnect();
  }
}

runTests();
