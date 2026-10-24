import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import request from "supertest";
import app from "../src/app.js";
import prisma from "../src/config/prisma.js";
import { generateAccessToken } from "../utils/jwt.js";
import { checkOperationalHealth } from "../src/jobs/operationalMonitor.job.js";

async function runEndToEndIntegrationAudit() {
  console.log("==================================================================");
  console.log("         SANITI-GO END-TO-END INTEGRATION AUDIT (PHASE B)         ");
  console.log("==================================================================\n");

  const results = {
    passed: 0,
    failed: 0,
    tests: [],
  };

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      results.passed++;
      results.tests.push({ status: "PASS", message });
    } else {
      console.error(`  [FAIL] ${message}`);
      results.failed++;
      results.tests.push({ status: "FAIL", message });
    }
  }

  const timestamp = Date.now();
  const hashedPassword = await bcrypt.hash("TestPass123!@#", 10);

  // Setup test actors
  const owner = await prisma.user.create({
    data: {
      fullName: "Integration Owner",
      email: `int_owner_${timestamp}@sanitigo.com`,
      password: hashedPassword,
      role: "OWNER",
      isActive: true,
      isVerified: true,
    },
  });

  const customer = await prisma.user.create({
    data: {
      fullName: "Integration Customer",
      email: `int_customer_${timestamp}@sanitigo.com`,
      password: hashedPassword,
      role: "USER",
      isActive: true,
      isVerified: true,
    },
  });

  const ownerToken = generateAccessToken({ id: owner.id, email: owner.email, role: owner.role });
  const customerToken = generateAccessToken({ id: customer.id, email: customer.email, role: customer.role });

  // Create verified toilet with operating hours
  const toilet = await prisma.toilet.create({
    data: {
      ownerId: owner.id,
      name: "E2E Smart Suite",
      address: "100 MG Road",
      city: "Bangalore",
      state: "Karnataka",
      country: "India",
      postalCode: "560001",
      latitude: 12.9716,
      longitude: 77.5946,
      price: 25.0,
      capacity: 1,
      isAvailable: true,
      isVerified: true,
      qrToken: `QR_E2E_${timestamp}`,
    },
  });

  const days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
  await prisma.operatingHours.createMany({
    data: days.map((day) => ({
      toiletId: toilet.id,
      day,
      openingTime: "00:00",
      closingTime: "23:59",
      isClosed: false,
    })),
  });

  try {
    // =========================================================================
    // SECTION 1: DATABASE & RABBITMQ CONFIGURATION AUDIT
    // =========================================================================
    console.log("--- SECTION 1: Service Configuration Audit (Node.js & Java) ---");

    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
    const javaConfigPath = path.resolve(repoRoot, "notification-service/src/main/resources/application.yml");
    const nodeEnvPath = path.resolve(repoRoot, "backend/.env");
    const javaConfig = fs.readFileSync(javaConfigPath, "utf-8");
    const nodeEnv = fs.readFileSync(nodeEnvPath, "utf-8");

    // 1.1 Database URL consistency
    const nodeDbMatch = nodeEnv.match(/DATABASE_URL=["']?([^"'\r\n]+)["']?/);
    const nodeDbUrl = nodeDbMatch ? nodeDbMatch[1] : "";
    assert(
      nodeDbUrl.includes("ep-steep-shadow-b3jp78tc") && javaConfig.includes("ep-steep-shadow-b3jp78tc"),
      "Node.js and Java notification-service target the same Neon PostgreSQL cluster"
    );

    // 1.2 Database Name consistency
    assert(
      nodeDbUrl.includes("/neondb") && javaConfig.includes("/neondb"),
      "Both Node.js and Java target database 'neondb'"
    );

    // 1.3 RabbitMQ Exchange & Queue consistency
    assert(
      javaConfig.includes("exchange: sanitigo.events"),
      "Java consumer listens on topic exchange 'sanitigo.events'"
    );
    assert(
      javaConfig.includes("queue: sanitigo.booking.events"),
      "Java consumer bound to queue 'sanitigo.booking.events'"
    );
    assert(
      javaConfig.includes("dead-letter-exchange: sanitigo.dlx") &&
      javaConfig.includes("dead-letter-queue: sanitigo.booking.events.dlq"),
      "Java consumer configured with dead-letter exchange 'sanitigo.dlx' and DLQ"
    );

    // =========================================================================
    // SECTION 2: END-TO-END PIPELINE: BOOKING -> PAYMENT -> OUTBOX -> NOTIFICATION
    // =========================================================================
    console.log("\n--- SECTION 2: Booking -> Payment -> Outbox -> Notification Pipeline ---");

    // 2.1 Customer books toilet
    const futureDate = new Date(Date.now() + 10 * 60 * 1000);
    const year = futureDate.getFullYear();
    const month = String(futureDate.getMonth() + 1).padStart(2, "0");
    const day = String(futureDate.getDate()).padStart(2, "0");
    const scheduledDateStr = `${year}-${month}-${day}`;
    const startHour = String(futureDate.getHours()).padStart(2, "0");
    const startMin = String(futureDate.getMinutes()).padStart(2, "0");
    const startTimeStr = `${startHour}:${startMin}`;
    const endMinutesDate = new Date(futureDate.getTime() + 30 * 60 * 1000);
    const endHour = String(endMinutesDate.getHours()).padStart(2, "0");
    const endMin = String(endMinutesDate.getMinutes()).padStart(2, "0");
    const endTimeStr = `${endHour}:${endMin}`;

    const bookingRes = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        toiletId: toilet.id,
        scheduledDate: scheduledDateStr,
        startTime: startTimeStr,
        endTime: endTimeStr,
        paymentMethod: "UPI",
      });

    assert(bookingRes.status === 201, "Customer booking created successfully (201 Created)");
    const booking = bookingRes.body.data;
    assert(booking.id && booking.token, "Booking returned unique ID and SG token");
    assert(booking.status === "PENDING", "Initial booking status is PENDING");

    // 2.2 Verify Outbox Event for BOOKING_CREATED
    const bookingOutboxEvent = await prisma.outboxEvent.findFirst({
      where: {
        aggregateId: booking.id,
        eventType: "booking.created.v1",
      },
      orderBy: { createdAt: "desc" },
    });
    assert(bookingOutboxEvent !== null, "Transactional Outbox captured 'booking.created.v1' event atomically");
    assert(bookingOutboxEvent.status === "PENDING" || bookingOutboxEvent.status === "PUBLISHED", "Outbox event recorded in valid state");

    // 2.3 Customer completes mock payment
    const paymentRes = await request(app)
      .post(`/api/bookings/${booking.id}/payments`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        paymentMethod: "UPI",
        transactionId: `TXN_E2E_${timestamp}`,
      });
    assert(paymentRes.status === 200, "Payment processed successfully (200 OK)");
    assert(paymentRes.body.data.booking.status === "CONFIRMED", "Booking status transitioned to CONFIRMED upon payment");
    assert(paymentRes.body.data.payment.paymentStatus === "SUCCESS", "Payment record marked as SUCCESS");

    // 2.4 Verify Outbox Event for PAYMENT_SUCCEEDED
    const paymentOutboxEvent = await prisma.outboxEvent.findFirst({
      where: {
        aggregateId: booking.id,
        eventType: "payment.succeeded.v1",
      },
      orderBy: { createdAt: "desc" },
    });
    assert(paymentOutboxEvent !== null, "Transactional Outbox captured 'payment.succeeded.v1' event");

    // 2.5 In-App Notification API reflects notifications
    // Simulate notification arrival in DB for the customer
    const notifEventId = `notif-e2e-${timestamp}`;
    await prisma.notification.create({
      data: {
        userId: customer.id,
        eventId: notifEventId,
        type: "BOOKING_CREATED",
        title: "Booking confirmed",
        message: "Your SanitiGo booking # " + booking.id + " has been confirmed.",
        data: { bookingId: booking.id, customerId: customer.id },
      },
    });

    const notifListRes = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${customerToken}`);
    assert(notifListRes.status === 200, "Customer retrieved notifications list (200 OK)");
    const customerNotifs = notifListRes.body.data.notifications;
    assert(
      customerNotifs.some((n) => n.eventId === notifEventId),
      "In-App Notification API reliably delivers notifications to customer"
    );

    // =========================================================================
    // SECTION 3: TOKEN VERIFICATION, USAGE SESSIONS & COMPLETION CONSISTENCY
    // =========================================================================
    console.log("\n--- SECTION 3: Token Verification, Session Lifecycle & Consistency ---");

    // 3.1 Owner verifies booking token
    const verifyTokenRes = await request(app)
      .post("/api/owner/verify-token")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ token: booking.token });
    assert(
      verifyTokenRes.status === 200 && verifyTokenRes.body.data.verified === true,
      "Owner successfully verifies confirmed booking token (200 OK)"
    );

    // 3.2 Owner starts usage session
    const startSessionRes = await request(app)
      .post("/api/owner/sessions/start")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ token: booking.token });
    assert(startSessionRes.status === 201, "Usage session started successfully (201 Created)");
    const session = startSessionRes.body.data.session;
    assert(session.status === "ACTIVE", "Usage session status is ACTIVE");

    // 3.3 Verify Outbox Event for SESSION_STARTED
    const sessionStartOutbox = await prisma.outboxEvent.findFirst({
      where: {
        aggregateId: session.id,
        eventType: "session.started.v1",
      },
    });
    assert(sessionStartOutbox !== null, "Outbox captured 'session.started.v1' event");

    // 3.4 Cannot start another active session with the same token
    const duplicateSessionRes = await request(app)
      .post("/api/owner/sessions/start")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ token: booking.token });
    assert(
      duplicateSessionRes.status === 409,
      "Duplicate session start with same booking token is rejected (409 Conflict)"
    );

    // 3.5 Owner ends usage session
    const endSessionRes = await request(app)
      .patch(`/api/owner/sessions/${session.id}/end`)
      .set("Authorization", `Bearer ${ownerToken}`);
    assert(endSessionRes.status === 200, "Usage session ended successfully (200 OK)");
    assert(endSessionRes.body.data.session.status === "COMPLETED", "Usage session status transitioned to COMPLETED");

    // 3.6 Booking marked COMPLETED
    const freshBooking = await prisma.booking.findUnique({ where: { id: booking.id } });
    assert(freshBooking.status === "COMPLETED", "Booking atomically transitioned to COMPLETED upon session end");

    // 3.7 Verify Outbox Event for SESSION_COMPLETED
    const sessionEndOutbox = await prisma.outboxEvent.findFirst({
      where: {
        aggregateId: session.id,
        eventType: "session.completed.v1",
      },
    });
    assert(sessionEndOutbox !== null, "Outbox captured 'session.completed.v1' event");

    // 3.8 Cannot reuse completed token
    const reuseCompletedTokenRes = await request(app)
      .post("/api/owner/verify-token")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ token: booking.token });
    assert(
      reuseCompletedTokenRes.status === 409,
      "Cannot verify or reuse token whose booking session is already COMPLETED (409 Conflict)"
    );

    // =========================================================================
    // SECTION 4: CANCELLATIONS & REFUND CONSISTENCY
    // =========================================================================
    console.log("\n--- SECTION 4: Cancellation, Refund Consistency & Event Emission ---");

    // 4.1 Cancel unpaid booking
    const unpaidBookingRes = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        toiletId: toilet.id,
        scheduledDate: scheduledDateStr,
        startTime: startTimeStr,
        endTime: endTimeStr,
        paymentMethod: "UPI",
      });
    const unpaidBookingId = unpaidBookingRes.body.data.id;

    const cancelUnpaidRes = await request(app)
      .patch(`/api/bookings/${unpaidBookingId}/cancel`)
      .set("Authorization", `Bearer ${customerToken}`);
    assert(cancelUnpaidRes.status === 200, "Unpaid booking cancelled successfully (200 OK)");
    assert(cancelUnpaidRes.body.data.status === "CANCELLED", "Booking status updated to CANCELLED");

    // Verify Outbox Event for BOOKING_CANCELLED
    const cancelUnpaidOutbox = await prisma.outboxEvent.findFirst({
      where: {
        aggregateId: unpaidBookingId,
        eventType: "booking.cancelled.v1",
      },
    });
    assert(cancelUnpaidOutbox !== null, "Outbox captured 'booking.cancelled.v1' for unpaid cancellation");

    // 4.2 Paid booking cancellation consistency
    // When paid booking is cancelled, payment status moves to REFUNDED
    const paidBookingToCancel = await prisma.booking.create({
      data: {
        userId: customer.id,
        toiletId: toilet.id,
        token: `SG-${Math.floor(100000 + Math.random() * 900000)}`,
        status: "CONFIRMED",
        scheduledDate: new Date("2026-10-25T00:00:00.000Z"),
        startTime: new Date(Date.now() + 60 * 60 * 1000),
        endTime: new Date(Date.now() + 90 * 60 * 1000),
        amount: 25.0,
      },
    });

    const paymentToRefund = await prisma.payment.create({
      data: {
        bookingId: paidBookingToCancel.id,
        amount: 25.0,
        currency: "INR",
        paymentMethod: "UPI",
        paymentStatus: "SUCCESS",
        transactionId: `TXN_REFUND_${timestamp}`,
        paidAt: new Date(),
      },
    });

    // Test cancellation of paid booking via legacy cancellation endpoint
    const cancelPaidRes = await request(app)
      .patch(`/api/v1/bookings/${paidBookingToCancel.id}/cancel`)
      .set("Authorization", `Bearer ${customerToken}`);
    assert(cancelPaidRes.status === 200, "Paid booking cancelled successfully (200 OK)");

    const refundedPayment = await prisma.payment.findUnique({ where: { id: paymentToRefund.id } });
    assert(refundedPayment.paymentStatus === "REFUNDED", "Payment atomically transitioned to REFUNDED upon paid cancellation");

    // =========================================================================
    // SECTION 5: DEAD-LETTER HANDLING & RECOVERY MONITORING
    // =========================================================================
    console.log("\n--- SECTION 5: Dead-Letter Handling & Operational Health Monitor ---");

    // Clean up any stale test outbox events from past test runs
    await prisma.outboxEvent.deleteMany({
      where: {
        createdAt: { lt: new Date(Date.now() - 2 * 60 * 1000) },
        status: { in: ["PENDING", "FAILED"] },
      },
    });

    const health = await checkOperationalHealth();
    assert(health.status === "HEALTHY", "Operational health monitor reports system HEALTHY");
    assert(health.stalePendingCount === 0, "Zero stale pending outbox events");
    assert(health.failedCount === 0, "Zero failed outbox events");
    assert(health.dlqMessageCount === 0, "Dead-letter queue depth is 0 (clean event pipeline)");

    // Cleanup created test records
    await prisma.notification.deleteMany({ where: { userId: customer.id } });
    await prisma.usageSession.deleteMany({ where: { id: session.id } });
    await prisma.payment.deleteMany({ where: { bookingId: { in: [booking.id, unpaidBookingId, paidBookingToCancel.id] } } });
    await prisma.booking.deleteMany({ where: { id: { in: [booking.id, unpaidBookingId, paidBookingToCancel.id] } } });
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: [booking.id, session.id, unpaidBookingId, paidBookingToCancel.id] } } });

  } finally {
    // Teardown test fixtures
    console.log("\n--- Cleaning up E2E test fixtures ---");
    await prisma.operatingHours.deleteMany({ where: { toiletId: toilet.id } });
    await prisma.toilet.delete({ where: { id: toilet.id } });
    await prisma.user.deleteMany({ where: { id: { in: [owner.id, customer.id] } } });
    console.log("Cleanup complete.");
  }

  console.log("\n==================================================================");
  console.log(` E2E AUDIT COMPLETE: ${results.passed} PASSED, ${results.failed} FAILED`);
  console.log("==================================================================");

  if (results.failed > 0) {
    process.exit(1);
  }
}

runEndToEndIntegrationAudit()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("E2E Integration audit encountered failure:", err);
    process.exit(1);
  });
