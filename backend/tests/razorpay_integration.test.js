import dotenv from "dotenv";
dotenv.config();

import crypto from "crypto";
import request from "supertest";
import app from "../src/app.js";
import prisma from "../src/config/prisma.js";
import { generateAccessToken } from "../utils/jwt.js";

describe("Phase 6.5 — Full Razorpay Gateway Integration Tests", () => {
  const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || "rzp_sec_sanitigo_dev_secret_2026";
  const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET || "whsec_dev_secret_sanitigo_2026";

  let customer;
  let customerToken;
  let owner;
  let toilet;

  beforeAll(async () => {
    process.env.RAZORPAY_KEY_SECRET = razorpayKeySecret;
    process.env.PAYMENT_WEBHOOK_SECRET = webhookSecret;

    customer = await prisma.user.create({
      data: {
        fullName: "Razorpay Test Customer",
        email: `rzp_cust_${Date.now()}@example.com`,
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
        fullName: "Razorpay Test Owner",
        email: `rzp_owner_${Date.now()}@example.com`,
        password: "hashedPassword123",
        role: "OWNER",
      },
    });

    toilet = await prisma.toilet.create({
      data: {
        ownerId: owner.id,
        name: "Razorpay Smart Suite",
        address: "500 Electronic City Phase 1",
        city: "Bengaluru",
        state: "Karnataka",
        country: "India",
        postalCode: "560100",
        price: 75.0,
        latitude: 12.8399,
        longitude: 77.677,
        qrToken: "QR_RZP_" + Date.now(),
        isAvailable: true,
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const createTestBooking = async (overrides = {}) => {
    return prisma.booking.create({
      data: {
        userId: customer.id,
        toiletId: toilet.id,
        amount: 75.0,
        scheduledDate: new Date("2026-12-20"),
        startTime: new Date("2026-12-20T10:00:00Z"),
        endTime: new Date("2026-12-20T11:00:00Z"),
        token: "SG-RZP-" + Math.floor(100000 + Math.random() * 900000),
        status: "PENDING",
        ...overrides,
      },
      include: { payment: true },
    });
  };

  const generateRazorpaySignature = (orderId, paymentId, secret = razorpayKeySecret) => {
    return crypto
      .createHmac("sha256", secret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");
  };

  it("1. Should create a Razorpay order with amount converted to paise and orderId saved on Payment record", async () => {
    const booking = await createTestBooking();

    const res = await request(app)
      .post(`/api/bookings/${booking.id}/payment/razorpay-order`)
      .set("Authorization", `Bearer ${customerToken}`);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.orderId).toMatch(/^order_/);
    expect(res.body.data.amount).toBe(75.0);
    expect(res.body.data.amountInPaise).toBe(7500);
    expect(res.body.data.currency).toBe("INR");

    // Verify DB state
    const payment = await prisma.payment.findUnique({
      where: { bookingId: booking.id },
    });
    expect(payment).not.toBeNull();
    expect(payment.orderId).toBe(res.body.data.orderId);
    expect(payment.paymentStatus).toBe("PENDING");
    expect(Number(payment.amount)).toBe(75.0);
  });

  it("2. Should reject Razorpay order creation if booking access window has already expired", async () => {
    const expiredBooking = await createTestBooking({
      scheduledDate: new Date("2020-01-01"),
      startTime: new Date("2020-01-01T10:00:00Z"),
      endTime: new Date("2020-01-01T10:30:00Z"),
    });

    const res = await request(app)
      .post(`/api/bookings/${expiredBooking.id}/payment/razorpay-order`)
      .set("Authorization", `Bearer ${customerToken}`);

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/access window has expired/i);
  });

  it("3. Should reject verify-razorpay with 400 when client signature is invalid or tampered", async () => {
    const booking = await createTestBooking();
    const orderRes = await request(app)
      .post(`/api/bookings/${booking.id}/payment/razorpay-order`)
      .set("Authorization", `Bearer ${customerToken}`);

    const orderId = orderRes.body.data.orderId;
    const paymentId = "pay_test_tampered_123456";
    const invalidSignature = "invalid_signature_hex_1234567890123456789012345678901234567890123456789012345678901234";

    const res = await request(app)
      .post(`/api/bookings/${booking.id}/payment/razorpay-verify`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: invalidSignature,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Invalid Razorpay payment signature/i);

    // Verify booking is still PENDING
    const dbBooking = await prisma.booking.findUnique({
      where: { id: booking.id },
      include: { payment: true },
    });
    expect(dbBooking.status).toBe("PENDING");
    expect(dbBooking.payment.paymentStatus).toBe("PENDING");
  });

  it("4. Should successfully verify authentic Razorpay signature, confirm booking atomically, and emit outbox event", async () => {
    const booking = await createTestBooking();
    const orderRes = await request(app)
      .post(`/api/bookings/${booking.id}/payment/razorpay-order`)
      .set("Authorization", `Bearer ${customerToken}`);

    const orderId = orderRes.body.data.orderId;
    const paymentId = "pay_valid_" + Date.now();
    const signature = generateRazorpaySignature(orderId, paymentId);

    const res = await request(app)
      .post(`/api/bookings/${booking.id}/payment/razorpay-verify`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: signature,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("SUCCESS");

    // Verify DB state
    const dbBooking = await prisma.booking.findUnique({
      where: { id: booking.id },
      include: { payment: true },
    });
    expect(dbBooking.status).toBe("CONFIRMED");
    expect(dbBooking.payment.paymentStatus).toBe("SUCCESS");
    expect(dbBooking.payment.transactionId).toBe(paymentId);
    expect(dbBooking.payment.orderId).toBe(orderId);
    expect(dbBooking.payment.paidAt).not.toBeNull();

    // Verify Outbox event
    const outboxEvent = await prisma.outboxEvent.findFirst({
      where: { aggregateId: booking.id, eventType: "payment.succeeded.v1" },
    });
    expect(outboxEvent).not.toBeNull();
    expect(outboxEvent.payload.data.bookingStatus).toBe("CONFIRMED");
  });

  it("5. Should be idempotent on duplicate verification calls with the same Razorpay payment ID", async () => {
    const booking = await createTestBooking();
    const orderRes = await request(app)
      .post(`/api/bookings/${booking.id}/payment/razorpay-order`)
      .set("Authorization", `Bearer ${customerToken}`);

    const orderId = orderRes.body.data.orderId;
    const paymentId = "pay_idemp_" + Date.now();
    const signature = generateRazorpaySignature(orderId, paymentId);

    // Call 1
    const res1 = await request(app)
      .post(`/api/bookings/${booking.id}/payment/razorpay-verify`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: signature,
      });
    expect(res1.status).toBe(200);
    expect(res1.body.data.status).toBe("SUCCESS");

    // Call 2
    const res2 = await request(app)
      .post(`/api/bookings/${booking.id}/payment/razorpay-verify`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: signature,
      });
    expect(res2.status).toBe(200);
    expect(res2.body.data.status).toBe("ALREADY_PROCESSED");

    // Only 1 outbox event
    const events = await prisma.outboxEvent.findMany({
      where: { aggregateId: booking.id, eventType: "payment.succeeded.v1" },
    });
    expect(events.length).toBe(1);
  });

  it("6. Should process native Razorpay webhook event (payment.captured) authenticated via x-razorpay-signature", async () => {
    const booking = await createTestBooking();
    const rzpPaymentId = "pay_wh_rzp_" + Date.now();
    const rzpOrderId = "order_wh_rzp_" + Date.now();

    // Standard native Razorpay webhook payload format
    const rzpWebhookPayload = {
      entity: "event",
      account_id: "acc_sanitigo_dev",
      event: "payment.captured",
      contains: ["payment"],
      payload: {
        payment: {
          entity: {
            id: rzpPaymentId,
            entity: "payment",
            amount: 7500, // 75.00 INR in paise
            currency: "INR",
            status: "captured",
            order_id: rzpOrderId,
            method: "upi",
            notes: {
              bookingId: booking.id,
            },
          },
        },
      },
      created_at: Math.floor(Date.now() / 1000),
    };

    const rawBody = JSON.stringify(rzpWebhookPayload);
    const webhookSig = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    const res = await request(app)
      .post("/api/payments/webhook")
      .set("Content-Type", "application/json")
      .set("x-razorpay-signature", webhookSig)
      .send(rawBody);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("PROCESSED");

    // Verify DB state
    const dbBooking = await prisma.booking.findUnique({
      where: { id: booking.id },
      include: { payment: true },
    });
    expect(dbBooking.status).toBe("CONFIRMED");
    expect(dbBooking.payment.paymentStatus).toBe("SUCCESS");
    expect(dbBooking.payment.transactionId).toBe(rzpPaymentId);
    expect(Number(dbBooking.payment.amount)).toBe(75.0);
  });
});
