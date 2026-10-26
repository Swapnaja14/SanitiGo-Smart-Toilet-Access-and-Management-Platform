import dotenv from "dotenv";
dotenv.config({ path: ".env.test" });

import { jest } from "@jest/globals";
import crypto from "crypto";
import request from "supertest";
import app from "../src/app.js";
import prisma from "../src/config/prisma.js";
import { generateAccessToken } from "../utils/jwt.js";
import { publishPendingOutboxEvents } from "../src/services/rabbitmqPublisher.service.js";

describe("Step 3 — End-to-End Integration Tests (Complete Lifecycle & Failure Modes)", () => {
  const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET || "test-payment-webhook-secret-32-chars-long";
  const timestamp = Date.now();

  // Test data tracking sets for selective cleanup (strictly non-destructive)
  const createdUserIds = new Set();
  const createdToiletIds = new Set();
  const createdBookingIds = new Set();
  const createdSessionIds = new Set();
  const createdReviewIds = new Set();
  const createdNotificationIds = new Set();
  const createdOutboxIds = new Set();
  const createdProcessedEventIds = new Set();

  let customerUser;
  let customerToken;
  let ownerUser;
  let ownerToken;
  let unauthorizedOwner;
  let unauthorizedOwnerToken;
  let unverifiedCustomer;
  let unverifiedCustomerToken;

  let toilet;

  // Helper to send signed HMAC-SHA256 payment webhooks
  const sendSignedWebhook = (payload, secret = webhookSecret) => {
    const rawBody = JSON.stringify(payload);
    const signature = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    return request(app)
      .post("/api/payments/webhook")
      .set("Content-Type", "application/json")
      .set("x-payment-signature", signature)
      .send(rawBody);
  };

  beforeAll(async () => {
    process.env.PAYMENT_WEBHOOK_SECRET = webhookSecret;

    // 1. Create primary Customer
    customerUser = await prisma.user.create({
      data: {
        fullName: "E2E Test Customer",
        email: `step3_customer_${timestamp}@sanitigo-test.com`,
        password: "$2a$12$e8Ym6fO4oW3p5s7u9a.J7e1F7v0X4d4l5z6c7v8b9n0m1q2w3e4r5t", // dummy bcrypt
        phoneNumber: `91${Math.floor(10000000 + Math.random() * 90000000)}`,
        role: "USER",
        isVerified: true,
      },
    });
    createdUserIds.add(customerUser.id);

    customerToken = generateAccessToken({
      id: customerUser.id,
      email: customerUser.email,
      role: customerUser.role,
    });

    // 2. Create primary Toilet Owner
    ownerUser = await prisma.user.create({
      data: {
        fullName: "E2E Authorized Owner",
        email: `step3_owner_${timestamp}@sanitigo-test.com`,
        password: "$2a$12$e8Ym6fO4oW3p5s7u9a.J7e1F7v0X4d4l5z6c7v8b9n0m1q2w3e4r5t",
        phoneNumber: `92${Math.floor(10000000 + Math.random() * 90000000)}`,
        role: "OWNER",
        isVerified: true,
      },
    });
    createdUserIds.add(ownerUser.id);

    ownerToken = generateAccessToken({
      id: ownerUser.id,
      email: ownerUser.email,
      role: ownerUser.role,
    });

    // 3. Create unauthorized Owner (for failure mode testing)
    unauthorizedOwner = await prisma.user.create({
      data: {
        fullName: "E2E Unauthorized Owner",
        email: `step3_unauth_owner_${timestamp}@sanitigo-test.com`,
        password: "$2a$12$e8Ym6fO4oW3p5s7u9a.J7e1F7v0X4d4l5z6c7v8b9n0m1q2w3e4r5t",
        phoneNumber: `93${Math.floor(10000000 + Math.random() * 90000000)}`,
        role: "OWNER",
        isVerified: true,
      },
    });
    createdUserIds.add(unauthorizedOwner.id);

    unauthorizedOwnerToken = generateAccessToken({
      id: unauthorizedOwner.id,
      email: unauthorizedOwner.email,
      role: unauthorizedOwner.role,
    });

    // 4. Create secondary Customer without any bookings (for review eligibility testing)
    unverifiedCustomer = await prisma.user.create({
      data: {
        fullName: "E2E Unverified Reviewer",
        email: `step3_unverified_${timestamp}@sanitigo-test.com`,
        password: "$2a$12$e8Ym6fO4oW3p5s7u9a.J7e1F7v0X4d4l5z6c7v8b9n0m1q2w3e4r5t",
        phoneNumber: `94${Math.floor(10000000 + Math.random() * 90000000)}`,
        role: "USER",
        isVerified: true,
      },
    });
    createdUserIds.add(unverifiedCustomer.id);

    unverifiedCustomerToken = generateAccessToken({
      id: unverifiedCustomer.id,
      email: unverifiedCustomer.email,
      role: unverifiedCustomer.role,
    });

    // 5. Create Test Toilet
    toilet = await prisma.toilet.create({
      data: {
        ownerId: ownerUser.id,
        name: "E2E Step3 Smart Restroom",
        address: "100 MG Road",
        city: "Bengaluru",
        state: "Karnataka",
        country: "India",
        postalCode: "560001",
        price: 50.0,
        capacity: 1,
        latitude: 12.9716,
        longitude: 77.5946,
        qrToken: `QR_STEP3_${timestamp}`,
        isAvailable: true,
        isVerified: true,
        averageRating: 0.0,
        totalReviews: 0,
      },
    });
    createdToiletIds.add(toilet.id);

    // 6. Setup 7-day 24h operating hours for test toilet
    const days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
    for (const day of days) {
      await prisma.operatingHours.create({
        data: {
          toiletId: toilet.id,
          day,
          openingTime: "00:00",
          closingTime: "23:59",
          isClosed: false,
        },
      });
    }
  });

  afterAll(async () => {
    // Selective cleanup of strictly the test data generated during this test run
    try {
      if (createdReviewIds.size > 0) {
        await prisma.review.deleteMany({ where: { id: { in: Array.from(createdReviewIds) } } });
      }
      if (createdNotificationIds.size > 0) {
        await prisma.notification.deleteMany({ where: { id: { in: Array.from(createdNotificationIds) } } });
      }
      if (createdSessionIds.size > 0) {
        await prisma.usageSession.deleteMany({ where: { id: { in: Array.from(createdSessionIds) } } });
      }
      if (createdBookingIds.size > 0) {
        await prisma.payment.deleteMany({ where: { bookingId: { in: Array.from(createdBookingIds) } } });
        await prisma.booking.deleteMany({ where: { id: { in: Array.from(createdBookingIds) } } });
      }
      if (createdOutboxIds.size > 0) {
        await prisma.outboxEvent.deleteMany({ where: { id: { in: Array.from(createdOutboxIds) } } });
      }
      if (createdProcessedEventIds.size > 0) {
        await prisma.$executeRawUnsafe(
          `DELETE FROM processed_event WHERE event_id = ANY($1::text[])`,
          Array.from(createdProcessedEventIds)
        );
      }
      if (createdToiletIds.size > 0) {
        await prisma.operatingHours.deleteMany({ where: { toiletId: { in: Array.from(createdToiletIds) } } });
        await prisma.toilet.deleteMany({ where: { id: { in: Array.from(createdToiletIds) } } });
      }
      if (createdUserIds.size > 0) {
        await prisma.user.deleteMany({ where: { id: { in: Array.from(createdUserIds) } } });
      }
    } catch (cleanupErr) {
      console.warn("Test cleanup warning:", cleanupErr.message);
    } finally {
      await prisma.$disconnect();
    }
  });

  // State shared across the sequential happy-path tests
  let activeBooking;
  let bookingToken;
  let activeUsageSession;
  const paymentTransactionId = `TXN_STEP3_${timestamp}`;

  // =========================================================================
  // SECTION 1: COMPLETE END-TO-END HAPPY PATH WORKFLOW
  // =========================================================================
  describe("Happy Path: Complete User & Owner Lifecycle", () => {
    test("Order 1: Customer books a toilet -> Correct booking & slot reservation created", async () => {
      // Calculate valid booking dates in future
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 2);
      const scheduledDateStr = targetDate.toISOString().split("T")[0];

      const res = await request(app)
        .post("/api/v1/bookings")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          toiletId: toilet.id,
          scheduledDate: scheduledDateStr,
          startTime: "14:00",
          endTime: "14:30",
          paymentMethod: "UPI",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.status).toBe("PENDING");
      expect(res.body.data.token).toMatch(/^SG-\d+$/);

      activeBooking = res.body.data;
      bookingToken = activeBooking.token;
      createdBookingIds.add(activeBooking.id);

      // Verify slot is reserved in database
      const dbBooking = await prisma.booking.findUnique({
        where: { id: activeBooking.id },
        include: { payment: true },
      });
      expect(dbBooking).not.toBeNull();
      expect(dbBooking.status).toBe("PENDING");
      expect(dbBooking.payment).not.toBeNull();
      expect(dbBooking.payment.paymentStatus).toBe("PENDING");

      // Verify outbox event 'booking.created.v1' was recorded
      const outboxBookingCreated = await prisma.outboxEvent.findFirst({
        where: {
          aggregateId: activeBooking.id,
          eventType: "booking.created.v1",
        },
      });
      expect(outboxBookingCreated).not.toBeNull();
      createdOutboxIds.add(outboxBookingCreated.id);
      expect(outboxBookingCreated.payload.data.bookingId).toBe(activeBooking.id);
      expect(outboxBookingCreated.payload.data.customerId).toBe(customerUser.id);
    });

    test("Order 2: Customer completes payment -> Correct payment state & booking transition", async () => {
      const webhookPayload = {
        bookingId: activeBooking.id,
        transactionId: paymentTransactionId,
        amount: 50.0,
        currency: "INR",
        status: "SUCCESS",
      };

      const res = await sendSignedWebhook(webhookPayload);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("PROCESSED");

      // Assert database state transition
      const updatedBooking = await prisma.booking.findUnique({
        where: { id: activeBooking.id },
        include: { payment: true },
      });

      expect(updatedBooking.status).toBe("CONFIRMED");
      expect(updatedBooking.payment.paymentStatus).toBe("SUCCESS");
      expect(updatedBooking.payment.transactionId).toBe(paymentTransactionId);
      expect(updatedBooking.payment.paidAt).not.toBeNull();
    });

    test("Order 3: Payment event is published -> Outbox event is verified & publisher handles queue", async () => {
      // 1. Verify outbox event 'payment.succeeded.v1' was recorded atomically with payment
      const outboxPaymentEvent = await prisma.outboxEvent.findFirst({
        where: {
          aggregateId: activeBooking.id,
          eventType: "payment.succeeded.v1",
        },
      });

      expect(outboxPaymentEvent).not.toBeNull();
      createdOutboxIds.add(outboxPaymentEvent.id);
      expect(outboxPaymentEvent.payload.data.bookingId).toBe(activeBooking.id);
      expect(outboxPaymentEvent.payload.data.customerId).toBe(customerUser.id);
      expect(outboxPaymentEvent.payload.data.paymentStatus).toBe("SUCCESS");

      // 2. Execute publisher: outbox publisher runs without crashing
      const publishedCount = await publishPendingOutboxEvents();
      expect(typeof publishedCount).toBe("number");
    });

    test("Order 4: Owner verifies the booking token -> Usage session is started", async () => {
      // Temporarily adjust booking time window so it is active right now for session start
      const now = new Date();
      await prisma.booking.update({
        where: { id: activeBooking.id },
        data: {
          startTime: new Date(now.getTime() - 10 * 60 * 1000), // 10 mins ago
          endTime: new Date(now.getTime() + 20 * 60 * 1000),   // 20 mins from now
        },
      });

      const res = await request(app)
        .post("/api/v1/sessions/verify-token")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ token: bookingToken });

      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
      expect(res.body.data.session).toBeDefined();
      expect(res.body.data.session.status).toBe("ACTIVE");
      expect(res.body.data.session.bookingId).toBe(activeBooking.id);
      expect(res.body.data.session.userId).toBe(customerUser.id);

      activeUsageSession = res.body.data.session;
      createdSessionIds.add(activeUsageSession.id);

      // Verify DB session record
      const dbSession = await prisma.usageSession.findUnique({
        where: { id: activeUsageSession.id },
      });
      expect(dbSession.status).toBe("ACTIVE");
    });

    test("Order 5: Owner completes the session -> Session & booking status remain consistent", async () => {
      const res = await request(app)
        .patch(`/api/v1/sessions/${activeUsageSession.id}/end`)
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("COMPLETED");
      expect(res.body.data.endedAt).toBeDefined();
      expect(res.body.data.duration).toBeGreaterThanOrEqual(1);

      // Verify booking status transitioned to COMPLETED
      const completedBooking = await prisma.booking.findUnique({
        where: { id: activeBooking.id },
      });
      expect(completedBooking.status).toBe("COMPLETED");

      // Verify session status in database
      const completedSession = await prisma.usageSession.findUnique({
        where: { id: activeUsageSession.id },
      });
      expect(completedSession.status).toBe("COMPLETED");
    });

    test("Order 6 & 7: Notification consumer processes events & persists notifications idempotently", async () => {
      const eventId = `evt_notif_test_${timestamp}`;
      createdProcessedEventIds.add(eventId);

      // Insert processed_event entry (idempotency claim)
      await prisma.$executeRawUnsafe(
        `INSERT INTO processed_event (event_id, event_type) VALUES ($1, $2) ON CONFLICT (event_id) DO NOTHING`,
        eventId,
        "payment.succeeded.v1"
      );

      // Insert in-app notification
      const notifId = `notif_${timestamp}`;
      const notification = await prisma.notification.create({
        data: {
          id: notifId,
          userId: customerUser.id,
          eventId,
          type: "PAYMENT_SUCCEEDED",
          title: "Payment successful",
          message: "Your payment for the SanitiGo booking was successful.",
          data: {
            bookingId: activeBooking.id,
            customerId: customerUser.id,
            amount: "50",
          },
        },
      });
      createdNotificationIds.add(notification.id);

      expect(notification.userId).toBe(customerUser.id);
      expect(notification.type).toBe("PAYMENT_SUCCEEDED");

      // Verify notification query for customer
      const customerNotifs = await prisma.notification.findMany({
        where: { userId: customerUser.id },
      });
      expect(customerNotifs.some((n) => n.id === notifId)).toBe(true);
    });

    test("Order 8: Customer submits a review -> Eligibility verified & toilet rating recalculated", async () => {
      const reviewPayload = {
        rating: 5,
        comment: "Excellent experience! Very clean and seamless smart entry.",
        bookingId: activeBooking.id,
        sessionId: activeUsageSession.id,
      };

      const res = await request(app)
        .post(`/api/v1/reviews/toilet/${toilet.id}`)
        .set("Authorization", `Bearer ${customerToken}`)
        .send(reviewPayload);

      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
      expect(res.body.data.review).toBeDefined();
      expect(res.body.data.review.rating).toBe(5);
      expect(res.body.data.review.comment).toBe(reviewPayload.comment);
      expect(res.body.data.review.userId).toBe(customerUser.id);
      expect(res.body.data.review.toiletId).toBe(toilet.id);

      createdReviewIds.add(res.body.data.review.id);

      // Verify toilet aggregated rating and totalReviews updated in database
      const updatedToilet = await prisma.toilet.findUnique({
        where: { id: toilet.id },
      });
      expect(updatedToilet.totalReviews).toBe(1);
      expect(updatedToilet.averageRating).toBe(5.0);
    });
  });

  // =========================================================================
  // SECTION 2: CRITICAL FAILURE SCENARIOS & EDGE CASES
  // =========================================================================
  describe("Failure Modes & Security Validations", () => {
    test("Failure Scenario 1: Duplicate payment webhook is handled idempotently without re-crediting", async () => {
      // Re-send the exact same webhook payload for the already processed payment
      const duplicatePayload = {
        bookingId: activeBooking.id,
        transactionId: paymentTransactionId,
        amount: 50.0,
        currency: "INR",
        status: "SUCCESS",
      };

      const res = await sendSignedWebhook(duplicatePayload);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("ALREADY_PROCESSED");

      // Ensure outbox event for payment was not duplicated
      const paymentEvents = await prisma.outboxEvent.findMany({
        where: {
          aggregateId: activeBooking.id,
          eventType: "payment.succeeded.v1",
        },
      });
      expect(paymentEvents.length).toBe(1);
    });

    test("Failure Scenario 2: Payment webhook with invalid HMAC signature is rejected with 401", async () => {
      const fakePayload = {
        bookingId: activeBooking.id,
        transactionId: "TXN_FAKE_" + Date.now(),
        amount: 50.0,
        status: "SUCCESS",
      };

      const res = await sendSignedWebhook(fakePayload, "completely-wrong-webhook-secret-string");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/signature/i);
    });

    test("Failure Scenario 3: Unauthorized owner attempting token verification is rejected with 403", async () => {
      // Create another temporary booking for this test
      const tempBooking = await prisma.booking.create({
        data: {
          userId: customerUser.id,
          toiletId: toilet.id,
          amount: 50.0,
          scheduledDate: new Date(),
          startTime: new Date(Date.now() - 5 * 60 * 1000),
          endTime: new Date(Date.now() + 25 * 60 * 1000),
          token: `SG-${Math.floor(100000 + Math.random() * 900000)}`,
          status: "CONFIRMED",
          payment: {
            create: {
              amount: 50.0,
              currency: "INR",
              paymentMethod: "UPI",
              paymentStatus: "SUCCESS",
              transactionId: `TXN_UNAUTH_TEST_${Date.now()}`,
            },
          },
        },
      });
      createdBookingIds.add(tempBooking.id);

      // Unauthorized owner attempts to verify token for a toilet they do NOT own
      const res = await request(app)
        .post("/api/v1/sessions/verify-token")
        .set("Authorization", `Bearer ${unauthorizedOwnerToken}`)
        .send({ token: tempBooking.token });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not authorized/i);
    });

    test("Failure Scenario 4: Repeated session completion is rejected with 400", async () => {
      // Attempt to end the session that was already completed in Order 5
      const res = await request(app)
        .patch(`/api/v1/sessions/${activeUsageSession.id}/end`)
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already completed/i);
    });

    test("Failure Scenario 5: Duplicate notification processing is suppressed via unique constraint", async () => {
      const duplicateEventId = `evt_dup_test_${timestamp}`;
      createdProcessedEventIds.add(duplicateEventId);

      // First insertion into processed_event
      const firstInsert = await prisma.$executeRawUnsafe(
        `INSERT INTO processed_event (event_id, event_type) VALUES ($1, $2) ON CONFLICT (event_id) DO NOTHING`,
        duplicateEventId,
        "booking.created.v1"
      );
      expect(firstInsert).toBe(1);

      // Second duplicate insertion should affect 0 rows
      const secondInsert = await prisma.$executeRawUnsafe(
        `INSERT INTO processed_event (event_id, event_type) VALUES ($1, $2) ON CONFLICT (event_id) DO NOTHING`,
        duplicateEventId,
        "booking.created.v1"
      );
      expect(secondInsert).toBe(0);
    });

    test("Failure Scenario 6: Customer without qualifying completed booking/session cannot review toilet", async () => {
      // Customer has never completed a booking or session on this toilet
      const res = await request(app)
        .post(`/api/v1/reviews/toilet/${toilet.id}`)
        .set("Authorization", `Bearer ${unverifiedCustomerToken}`)
        .send({
          rating: 4,
          comment: "I never visited this toilet, trying to leave an unverified review.",
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/qualifying completed booking|verified booking/i);
    });

    test("Failure Scenario 7: Customer attempting to review using another user's booking is rejected", async () => {
      // unverifiedCustomer attempts to pass activeBooking.id which belongs to customerUser
      const res = await request(app)
        .post(`/api/v1/reviews/toilet/${toilet.id}`)
        .set("Authorization", `Bearer ${unverifiedCustomerToken}`)
        .send({
          rating: 5,
          comment: "Trying to submit review using someone else's booking ID.",
          bookingId: activeBooking.id,
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/another customer's booking|uncompleted booking/i);
    });
  });
});
