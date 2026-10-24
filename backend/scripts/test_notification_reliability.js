import request from "supertest";
import app from "../src/app.js";
import prisma from "../src/config/prisma.js";
import { generateAccessToken } from "../utils/jwt.js";
import crypto from "crypto";

async function runReliabilityTests() {
  console.log("==========================================================");
  console.log("   STEP 2: NOTIFICATION RELIABILITY & ISOLATION TESTS     ");
  console.log("==========================================================\n");

  let userA, userB;
  let tokenA, tokenB;
  const createdNotificationIds = [];

  try {
    // 1. Setup two isolated users
    const timestamp = Date.now();
    userA = await prisma.user.create({
      data: {
        fullName: "Reliability User A",
        email: `user_a_${timestamp}@example.com`,
        password: "password123",
        role: "USER",
        isVerified: true,
        isActive: true,
      },
    });

    userB = await prisma.user.create({
      data: {
        fullName: "Reliability User B",
        email: `user_b_${timestamp}@example.com`,
        password: "password123",
        role: "USER",
        isVerified: true,
        isActive: true,
      },
    });

    tokenA = generateAccessToken({ id: userA.id, email: userA.email, role: userA.role });
    tokenB = generateAccessToken({ id: userB.id, email: userB.email, role: userB.role });

    console.log(`[Setup] User A created: ${userA.id} (${userA.email})`);
    console.log(`[Setup] User B created: ${userB.id} (${userB.email})`);

    // Helper to seed notifications
    async function seedNotification(userId, type, title, message) {
      const notif = await prisma.notification.create({
        data: {
          userId,
          eventId: crypto.randomUUID(),
          type,
          title,
          message,
          data: { test: true },
          readAt: null,
        },
      });
      createdNotificationIds.push(notif.id);
      return notif;
    }

    // Seed 3 notifications for User A and 2 notifications for User B
    const notifA1 = await seedNotification(userA.id, "BOOKING_CREATED", "Booking 1", "Booking 1 created");
    const notifA2 = await seedNotification(userA.id, "PAYMENT_SUCCEEDED", "Payment 1", "Payment 1 succeeded");
    const notifA3 = await seedNotification(userA.id, "BOOKING_CANCELLED", "Booking 2", "Booking 2 cancelled");

    const notifB1 = await seedNotification(userB.id, "BOOKING_CREATED", "User B Booking", "User B booking created");
    const notifB2 = await seedNotification(userB.id, "SESSION_COMPLETED", "User B Session", "User B session completed");

    console.log(`[Setup] Seeded 3 notifications for User A and 2 notifications for User B.\n`);

    // -----------------------------------------------------------------------
    // TEST 1: User-Specific Isolation on List & Unread Count
    // -----------------------------------------------------------------------
    console.log("--- Test 1: User-Specific Isolation ---");
    const listResA = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${tokenA}`);

    console.log(`User A notification count: ${listResA.body.data.notifications.length} (Expected: 3)`);
    if (listResA.body.data.notifications.length !== 3) {
      throw new Error(`User A expected 3 notifications, got ${listResA.body.data.notifications.length}`);
    }

    // Ensure none of User B's notifications appear in User A's response
    const leakedToA = listResA.body.data.notifications.some(
      (n) => n.id === notifB1.id || n.id === notifB2.id
    );
    if (leakedToA) {
      throw new Error("SECURITY VIOLATION: User B notification leaked into User A response!");
    }

    const unreadCountA = await request(app)
      .get("/api/notifications/unread-count")
      .set("Authorization", `Bearer ${tokenA}`);
    console.log(`User A unread count: ${unreadCountA.body.data.unreadCount} (Expected: 3)`);
    if (unreadCountA.body.data.unreadCount !== 3) {
      throw new Error(`User A expected unread count 3, got ${unreadCountA.body.data.unreadCount}`);
    }

    const unreadCountB = await request(app)
      .get("/api/notifications/unread-count")
      .set("Authorization", `Bearer ${tokenB}`);
    console.log(`User B unread count: ${unreadCountB.body.data.unreadCount} (Expected: 2)`);
    if (unreadCountB.body.data.unreadCount !== 2) {
      throw new Error(`User B expected unread count 2, got ${unreadCountB.body.data.unreadCount}`);
    }
    console.log("✓ Test 1 Passed: User isolation verified.\n");

    // -----------------------------------------------------------------------
    // TEST 2: Pagination Boundaries and Query Filters
    // -----------------------------------------------------------------------
    console.log("--- Test 2: Pagination and Filtering ---");
    // Request page 1 with limit 2
    const page1Res = await request(app)
      .get("/api/notifications?page=1&limit=2")
      .set("Authorization", `Bearer ${tokenA}`);

    console.log(`Page 1 returned: ${page1Res.body.data.notifications.length} items (limit: 2, total: ${page1Res.body.data.pagination.total}, totalPages: ${page1Res.body.data.pagination.totalPages})`);
    if (page1Res.body.data.notifications.length !== 2 || page1Res.body.data.pagination.totalPages !== 2) {
      throw new Error("Pagination Page 1 validation failed");
    }

    // Request page 2 with limit 2
    const page2Res = await request(app)
      .get("/api/notifications?page=2&limit=2")
      .set("Authorization", `Bearer ${tokenA}`);

    console.log(`Page 2 returned: ${page2Res.body.data.notifications.length} items (Expected: 1)`);
    if (page2Res.body.data.notifications.length !== 1) {
      throw new Error("Pagination Page 2 validation failed");
    }

    // Test invalid pagination params (e.g. limit > 100 or negative page)
    const invalidPageRes = await request(app)
      .get("/api/notifications?page=-1&limit=20")
      .set("Authorization", `Bearer ${tokenA}`);
    if (invalidPageRes.status !== 400) {
      throw new Error(`Expected 400 for invalid page param, got ${invalidPageRes.status}`);
    }
    console.log("✓ Test 2 Passed: Pagination boundaries and validation confirmed.\n");

    // -----------------------------------------------------------------------
    // TEST 3: User Cross-Access Protection on Mark Read
    // -----------------------------------------------------------------------
    console.log("--- Test 3: Cross-User Mark Read Access Protection ---");
    // User A attempts to mark User B's notification as read
    const crossAccessRes = await request(app)
      .patch(`/api/notifications/${notifB1.id}/read`)
      .set("Authorization", `Bearer ${tokenA}`);

    console.log(`User A modifying User B's notification HTTP Status: ${crossAccessRes.status} (Expected: 404)`);
    if (crossAccessRes.status !== 404) {
      throw new Error(`Expected 404 Not Found when User A attempts to read User B's notification, got ${crossAccessRes.status}`);
    }

    // Verify User B's notification remains unread
    const notifB1Check = await prisma.notification.findUnique({ where: { id: notifB1.id } });
    if (notifB1Check.readAt !== null) {
      throw new Error("User B's notification was improperly updated by User A!");
    }
    console.log("✓ Test 3 Passed: Cross-user mutation correctly prevented with 404.\n");

    // -----------------------------------------------------------------------
    // TEST 4: Read-State Updates & Idempotency
    // -----------------------------------------------------------------------
    console.log("--- Test 4: Read-State Updates and Idempotency ---");
    // User A marks notifA1 as read
    const markReadRes = await request(app)
      .patch(`/api/notifications/${notifA1.id}/read`)
      .set("Authorization", `Bearer ${tokenA}`);

    console.log(`Marked notifA1 as read. Status: ${markReadRes.status}`);
    const firstReadAt = markReadRes.body.data.notification.readAt;
    if (!firstReadAt) {
      throw new Error("Expected readAt timestamp to be populated");
    }

    // Calling mark read again should be idempotent and return 200 without error
    const repeatMarkReadRes = await request(app)
      .patch(`/api/notifications/${notifA1.id}/read`)
      .set("Authorization", `Bearer ${tokenA}`);

    console.log(`Repeat mark notifA1 as read (idempotency check). Status: ${repeatMarkReadRes.status}`);
    if (repeatMarkReadRes.status !== 200) {
      throw new Error(`Repeat mark read expected 200, got ${repeatMarkReadRes.status}`);
    }

    // Verify unread count decreased by 1 for User A, while User B is unaffected
    const countAfterOneReadA = await request(app)
      .get("/api/notifications/unread-count")
      .set("Authorization", `Bearer ${tokenA}`);
    console.log(`User A unread count after 1 read: ${countAfterOneReadA.body.data.unreadCount} (Expected: 2)`);
    if (countAfterOneReadA.body.data.unreadCount !== 2) {
      throw new Error(`Expected unread count 2, got ${countAfterOneReadA.body.data.unreadCount}`);
    }

    const countAfterOneReadB = await request(app)
      .get("/api/notifications/unread-count")
      .set("Authorization", `Bearer ${tokenB}`);
    console.log(`User B unread count (unaffected): ${countAfterOneReadB.body.data.unreadCount} (Expected: 2)`);
    if (countAfterOneReadB.body.data.unreadCount !== 2) {
      throw new Error(`Expected User B unread count 2, got ${countAfterOneReadB.body.data.unreadCount}`);
    }
    console.log("✓ Test 4 Passed: Read-state mutation and idempotency confirmed.\n");

    // -----------------------------------------------------------------------
    // TEST 5: Mark All Read Scoped to User
    // -----------------------------------------------------------------------
    console.log("--- Test 5: Mark All Read Scoped to User ---");
    // User A calls read-all (should update remaining 2 notifications for User A)
    const readAllResA = await request(app)
      .patch("/api/notifications/read-all")
      .set("Authorization", `Bearer ${tokenA}`);

    console.log(`User A read-all updatedCount: ${readAllResA.body.data.updatedCount} (Expected: 2)`);
    if (readAllResA.body.data.updatedCount !== 2) {
      throw new Error(`Expected updatedCount 2, got ${readAllResA.body.data.updatedCount}`);
    }

    // User A unread count should now be 0
    const finalCountA = await request(app)
      .get("/api/notifications/unread-count")
      .set("Authorization", `Bearer ${tokenA}`);
    console.log(`User A final unread count: ${finalCountA.body.data.unreadCount} (Expected: 0)`);
    if (finalCountA.body.data.unreadCount !== 0) {
      throw new Error(`Expected User A unread count 0, got ${finalCountA.body.data.unreadCount}`);
    }

    // User B unread count must still be 2!
    const finalCountB = await request(app)
      .get("/api/notifications/unread-count")
      .set("Authorization", `Bearer ${tokenB}`);
    console.log(`User B final unread count: ${finalCountB.body.data.unreadCount} (Expected: 2)`);
    if (finalCountB.body.data.unreadCount !== 2) {
      throw new Error(`Security Violation: User A read-all affected User B's notifications!`);
    }
    console.log("✓ Test 5 Passed: read-all is strictly scoped to the authenticated user.\n");

    console.log("==========================================================");
    console.log("   ALL NOTIFICATION RELIABILITY TESTS PASSED!            ");
    console.log("==========================================================");
  } catch (error) {
    console.error("Reliability test error:", error);
    process.exit(1);
  } finally {
    // Cleanup created test records
    if (createdNotificationIds.length > 0) {
      await prisma.notification.deleteMany({
        where: { id: { in: createdNotificationIds } },
      });
    }
    if (userA) {
      await prisma.user.delete({ where: { id: userA.id } }).catch(() => {});
    }
    if (userB) {
      await prisma.user.delete({ where: { id: userB.id } }).catch(() => {});
    }
    await prisma.$disconnect();
  }
}

runReliabilityTests();
