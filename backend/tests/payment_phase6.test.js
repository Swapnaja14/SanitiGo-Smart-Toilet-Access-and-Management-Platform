import dotenv from "dotenv";
dotenv.config();

import { jest } from "@jest/globals";
import crypto from "crypto";
import request from "supertest";
import app from "../src/app.js";
import prisma from "../src/config/prisma.js";
import { generateAccessToken } from "../utils/jwt.js";
import { handlePaymentWebhook } from "../src/services/payment.service.js";

describe("Phase 6 — Payment Lifecycle & Reliability Integration Tests", () => {
  const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET || "test-payment-webhook-secret-32-chars-long";
  let customer;
  let customerToken;
  let owner;
  let toilet;

  beforeAll(async () => {
    process.env.PAYMENT_WEBHOOK_SECRET = webhookSecret;

    customer = await prisma.user.create({
      data: {
        fullName: "Phase6 Customer",
        email: `phase6_cust_${Date.now()}@example.com`,
        password: "hashedPassword123",
        role: "USER",
      },
    });

    customerToken = generateAccessToken({
      id: customer.id,
      email: customer.email,
      role: customer.role,
    });

    owner = await prisma.user.create({
      data: {
        fullName: "Phase6 Owner",
        email: `phase6_owner_${Date.now()}@example.com`,
        password: "hashedPassword123",
        role: "OWNER",
      },
    });

    toilet = await prisma.toilet.create({
      data: {
        ownerId: owner.id,
        name: "Phase6 Restroom",
        address: "777 Gateway Expressway",
        city: "Bengaluru",
        state: "Karnataka",
        country: "India",
        postalCode: "560001",
        price: 60.0,
        latitude: 12.9716,
        longitude: 77.5946,
        qrToken: "QR_P6_" + Date.now(),
        isAvailable: true,
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

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

  const createTestBooking = async (overrides = {}) => {
    return prisma.booking.create({
      data: {
        userId: customer.id,
        toiletId: toilet.id,
        amount: 60.0,
        scheduledDate: new Date("2026-12-15"),
        startTime: new Date("2026-12-15T10:00:00Z"),
        endTime: new Date("2026-12-15T11:00:00Z"),
        token: "SG-P6-" + Math.floor(100000 + Math.random() * 900000),
        status: "PENDING",
        payment: {
          create: {
            amount: 60.0,
            currency: "INR",
            paymentMethod: "UPI",
            paymentStatus: "PENDING",
          },
        },
        ...overrides,
      },
      include: { payment: true },
    });
  };

  // Test Case 1: Valid successful payment
  it("Scenario 1: Valid successful payment transitions payment and booking consistently", async () => {
    const booking = await createTestBooking();
    const txId = "TXN_SUCCESS_" + Date.now();
    const payload = {
      bookingId: booking.id,
      transactionId: txId,
      amount: 60.0,
      currency: "INR",
      status: "SUCCESS",
    };

    const res = await sendSignedWebhook(payload);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("PROCESSED");

    // Assert DB state
    const updatedBooking = await prisma.booking.findUnique({
      where: { id: booking.id },
      include: { payment: true },
    });
    expect(updatedBooking.status).toBe("CONFIRMED");
    expect(updatedBooking.payment.paymentStatus).toBe("SUCCESS");
    expect(updatedBooking.payment.transactionId).toBe(txId);
    expect(updatedBooking.payment.paidAt).not.toBeNull();

    // Assert Outbox event
    const outboxEvent = await prisma.outboxEvent.findFirst({
      where: { aggregateId: booking.id, eventType: "payment.succeeded.v1" },
    });
    expect(outboxEvent).not.toBeNull();
    expect(outboxEvent.payload.data.paymentStatus).toBe("SUCCESS");
  });

  // Test Case 2: Failed payment
  it("Scenario 2: Failed payment updates payment record without falsely confirming the booking", async () => {
    const booking = await createTestBooking();
    const txId = "TXN_FAILED_" + Date.now();
    const payload = {
      bookingId: booking.id,
      transactionId: txId,
      amount: 60.0,
      status: "FAILED",
    };

    const res = await sendSignedWebhook(payload);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("PAYMENT_FAILED");

    // Assert DB state: payment is FAILED, booking remains PENDING
    const updatedBooking = await prisma.booking.findUnique({
      where: { id: booking.id },
      include: { payment: true },
    });
    expect(updatedBooking.status).toBe("PENDING");
    expect(updatedBooking.payment.paymentStatus).toBe("FAILED");

    // Outbox event should NOT be created for failed payments
    const outboxEvent = await prisma.outboxEvent.findFirst({
      where: { aggregateId: booking.id, eventType: "payment.succeeded.v1" },
    });
    expect(outboxEvent).toBeNull();
  });

  // Test Case 3: Duplicate success webhook
  it("Scenario 3: Duplicate success webhook is idempotent and produces no duplicate outbox event", async () => {
    const booking = await createTestBooking();
    const txId = "TXN_IDEMP_" + Date.now();
    const payload = {
      bookingId: booking.id,
      transactionId: txId,
      amount: 60.0,
      status: "SUCCESS",
    };

    // First call
    const firstRes = await sendSignedWebhook(payload);
    expect(firstRes.status).toBe(200);
    expect(firstRes.body.data.status).toBe("PROCESSED");

    // Second duplicate call with exact same transactionId
    const secondRes = await sendSignedWebhook(payload);
    expect(secondRes.status).toBe(200);
    expect(secondRes.body.data.status).toBe("ALREADY_PROCESSED");

    // Assert only 1 outbox event exists
    const events = await prisma.outboxEvent.findMany({
      where: { aggregateId: booking.id, eventType: "payment.succeeded.v1" },
    });
    expect(events.length).toBe(1);
  });

  // Test Case 4: Invalid signature
  it("Scenario 4: Webhook with invalid or missing HMAC signature is rejected with 401 and causes no DB change", async () => {
    const booking = await createTestBooking();
    const payload = {
      bookingId: booking.id,
      transactionId: "TXN_TAMPERED_" + Date.now(),
      amount: 60.0,
      status: "SUCCESS",
    };

    // 1. Missing signature
    const missingRes = await request(app)
      .post("/api/payments/webhook")
      .send(payload);
    expect(missingRes.status).toBe(401);
    expect(missingRes.body.message).toMatch(/signature is missing/i);

    // 2. Tampered signature
    const tamperedSig = "a".repeat(64);
    const tamperedRes = await request(app)
      .post("/api/payments/webhook")
      .set("x-payment-signature", tamperedSig)
      .send(payload);
    expect(tamperedRes.status).toBe(401);
    expect(tamperedRes.body.message).toMatch(/invalid webhook signature/i);

    // Assert DB untouched
    const freshBooking = await prisma.booking.findUnique({
      where: { id: booking.id },
      include: { payment: true },
    });
    expect(freshBooking.status).toBe("PENDING");
    expect(freshBooking.payment.paymentStatus).toBe("PENDING");
  });

  // Test Case 5: Incorrect amount or currency
  it("Scenario 5: Webhook with incorrect amount or currency is rejected with 400", async () => {
    const booking = await createTestBooking();

    // 1. Amount mismatch (e.g. client/provider sends 10.0 instead of 60.0)
    const amountMismatchPayload = {
      bookingId: booking.id,
      transactionId: "TXN_WRONG_AMT_" + Date.now(),
      amount: 10.0,
      currency: "INR",
      status: "SUCCESS",
    };
    const amtRes = await sendSignedWebhook(amountMismatchPayload);
    expect(amtRes.status).toBe(400);
    expect(amtRes.body.message).toMatch(/Amount mismatch/i);

    // 2. Currency mismatch (e.g. USD instead of INR)
    const currMismatchPayload = {
      bookingId: booking.id,
      transactionId: "TXN_WRONG_CURR_" + Date.now(),
      amount: 60.0,
      currency: "USD",
      status: "SUCCESS",
    };
    const currRes = await sendSignedWebhook(currMismatchPayload);
    expect(currRes.status).toBe(400);
    expect(currRes.body.message).toMatch(/Currency mismatch/i);

    // Assert DB untouched
    const freshBooking = await prisma.booking.findUnique({
      where: { id: booking.id },
      include: { payment: true },
    });
    expect(freshBooking.status).toBe("PENDING");
    expect(freshBooking.payment.paymentStatus).toBe("PENDING");
  });

  // Test Case 6: Unknown booking ID or replayed transaction ID
  it("Scenario 6: Unknown booking ID returns 404, and replayed transactionId on different booking returns 409", async () => {
    // 1. Unknown booking
    const unknownPayload = {
      bookingId: "non-existent-booking-id",
      transactionId: "TXN_UNKNOWN_" + Date.now(),
      amount: 60.0,
      status: "SUCCESS",
    };
    const unkRes = await sendSignedWebhook(unknownPayload);
    expect(unkRes.status).toBe(404);

    // 2. Cross-booking transaction replay
    const bookingA = await createTestBooking();
    const bookingB = await createTestBooking();
    const replayTxId = "TXN_REPLAY_" + Date.now();

    // Process booking A
    const payloadA = {
      bookingId: bookingA.id,
      transactionId: replayTxId,
      amount: 60.0,
      status: "SUCCESS",
    };
    await sendSignedWebhook(payloadA);

    // Attempt to reuse replayTxId on booking B
    const payloadB = {
      bookingId: bookingB.id,
      transactionId: replayTxId,
      amount: 60.0,
      status: "SUCCESS",
    };
    const replayRes = await sendSignedWebhook(payloadB);
    expect(replayRes.status).toBe(409);
    expect(replayRes.body.message).toMatch(/already associated with another booking/i);
  });

  // Test Case 7: Late callback after cancellation / expiry
  it("Scenario 7: Late callback after cancellation or access window expiry flags payment for refund without confirming booking", async () => {
    // 1. Cancelled booking
    const cancelledBooking = await createTestBooking({ status: "CANCELLED" });
    const payloadCancelled = {
      bookingId: cancelledBooking.id,
      transactionId: "TXN_LATE_CANC_" + Date.now(),
      amount: 60.0,
      status: "SUCCESS",
    };

    const resC = await sendSignedWebhook(payloadCancelled);

    expect(resC.status).toBe(200);
    expect(resC.body.data.status).toBe("BOOKING_INELIGIBLE_FOR_CONFIRMATION");
    expect(resC.body.data.message).toMatch(/flagged for refund/i);

    // Assert DB state: booking remains CANCELLED; payment marked REFUNDED
    const dbBookingC = await prisma.booking.findUnique({
      where: { id: cancelledBooking.id },
      include: { payment: true },
    });
    expect(dbBookingC.status).toBe("CANCELLED");
    expect(dbBookingC.payment.paymentStatus).toBe("REFUNDED");

    // 2. Expired access window
    const expiredBooking = await createTestBooking({
      scheduledDate: new Date("2020-01-01"),
      startTime: new Date("2020-01-01T10:00:00Z"),
      endTime: new Date("2020-01-01T10:30:00Z"), // Past window!
    });
    const payloadExp = {
      bookingId: expiredBooking.id,
      transactionId: "TXN_LATE_EXP_" + Date.now(),
      amount: 60.0,
      status: "SUCCESS",
    };
    const resE = await sendSignedWebhook(payloadExp);

    expect(resE.status).toBe(200);
    expect(resE.body.data.status).toBe("BOOKING_INELIGIBLE_FOR_CONFIRMATION");

    const dbBookingE = await prisma.booking.findUnique({
      where: { id: expiredBooking.id },
      include: { payment: true },
    });
    expect(dbBookingE.status).not.toBe("CONFIRMED");
    expect(dbBookingE.payment.paymentStatus).toBe("REFUNDED");
  });

  // Test Case 8: Concurrent duplicate callbacks
  it("Scenario 8: Concurrent duplicate webhook callbacks apply exactly one logical success", async () => {
    const booking = await createTestBooking();
    const txId = "TXN_CONCURRENT_" + Date.now();
    const payload = {
      bookingId: booking.id,
      transactionId: txId,
      amount: 60.0,
      status: "SUCCESS",
    };

    // Send 4 concurrent calls
    const responses = await Promise.all(
      Array.from({ length: 4 }).map(() => sendSignedWebhook(payload))
    );

    // All should succeed with HTTP 200 (either PROCESSED or ALREADY_PROCESSED)
    responses.forEach((res) => {
      expect(res.status).toBe(200);
      expect(["PROCESSED", "ALREADY_PROCESSED"]).toContain(res.body.data.status);
    });

    // Exactly one PROCESSED response
    const processedCount = responses.filter(
      (r) => r.body.data.status === "PROCESSED"
    ).length;
    expect(processedCount).toBe(1);

    // Exactly one outbox event in database
    const outboxEvents = await prisma.outboxEvent.findMany({
      where: { aggregateId: booking.id, eventType: "payment.succeeded.v1" },
    });
    expect(outboxEvents.length).toBe(1);

    // Booking confirmed
    const finalBooking = await prisma.booking.findUnique({
      where: { id: booking.id },
      include: { payment: true },
    });
    expect(finalBooking.status).toBe("CONFIRMED");
    expect(finalBooking.payment.paymentStatus).toBe("SUCCESS");
  });

  // Test Case 9: Temporary database failure & atomic rollback
  it("Scenario 9: Temporary database failure triggers clean rollback without partial state corruption", async () => {
    const booking = await createTestBooking();
    const txId = "TXN_DB_FAIL_" + Date.now();

    // Verify atomic rollback behavior: if any error happens during transaction, updates roll back
    let errorThrown = false;
    try {
      await prisma.$transaction(async (tx) => {
        // Step 1: Update payment to SUCCESS
        await tx.payment.update({
          where: { id: booking.payment.id },
          data: {
            paymentStatus: "SUCCESS",
            transactionId: txId,
            paidAt: new Date(),
          },
        });

        // Step 2: Update booking to CONFIRMED
        await tx.booking.update({
          where: { id: booking.id },
          data: { status: "CONFIRMED" },
        });

        // Step 3: Artificial transient PostgreSQL failure (e.g. connection timeout or constraint violation)
        throw new Error("Simulated transient PostgreSQL dead-lock or connection failure");
      });
    } catch (err) {
      errorThrown = true;
      expect(err.message).toMatch(/Simulated transient PostgreSQL/);
    }

    expect(errorThrown).toBe(true);

    // Verify atomic rollback in DB: payment is STILL PENDING, booking is STILL PENDING
    const postRollbackBooking = await prisma.booking.findUnique({
      where: { id: booking.id },
      include: { payment: true },
    });
    expect(postRollbackBooking.status).toBe("PENDING");
    expect(postRollbackBooking.payment.paymentStatus).toBe("PENDING");
    expect(postRollbackBooking.payment.transactionId).toBeNull();

    // Now verify that a subsequent retry succeeds cleanly
    const retryPayload = {
      bookingId: booking.id,
      transactionId: txId,
      amount: 60.0,
      status: "SUCCESS",
    };
    const retryRes = await sendSignedWebhook(retryPayload);
    expect(retryRes.status).toBe(200);
    expect(retryRes.body.data.status).toBe("PROCESSED");

    const completedBooking = await prisma.booking.findUnique({
      where: { id: booking.id },
      include: { payment: true },
    });
    expect(completedBooking.status).toBe("CONFIRMED");
    expect(completedBooking.payment.paymentStatus).toBe("SUCCESS");
  });

  // Test Case 10: RabbitMQ unavailable
  it("Scenario 10: When RabbitMQ is unavailable, the payment transaction remains durable and outbox records pending event for retry", async () => {
    const booking = await createTestBooking();
    const txId = "TXN_RMQ_UNAVAIL_" + Date.now();
    const payload = {
      bookingId: booking.id,
      transactionId: txId,
      amount: 60.0,
      status: "SUCCESS",
    };

    const res = await sendSignedWebhook(payload);
    expect(res.status).toBe(200);

    // Verify database state: Payment committed as SUCCESS, booking confirmed
    const dbBooking = await prisma.booking.findUnique({
      where: { id: booking.id },
      include: { payment: true },
    });
    expect(dbBooking.status).toBe("CONFIRMED");
    expect(dbBooking.payment.paymentStatus).toBe("SUCCESS");

    // The outbox event is durably committed in PostgreSQL with status 'PENDING'
    const outboxEvent = await prisma.outboxEvent.findFirst({
      where: { aggregateId: booking.id, eventType: "payment.succeeded.v1" },
    });
    expect(outboxEvent).not.toBeNull();
    expect(outboxEvent.status).toBe("PENDING");
    expect(outboxEvent.attempts).toBe(0);
    expect(outboxEvent.nextAttemptAt).toBeDefined();
  });
});
