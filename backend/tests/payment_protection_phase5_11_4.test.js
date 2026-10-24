import dotenv from "dotenv";
dotenv.config();

import crypto from "crypto";
import request from "supertest";
import app from "../src/app.js";
import prisma from "../src/config/prisma.js";
import { generateAccessToken } from "../utils/jwt.js";
import { validateEnv } from "../src/config/envValidator.js";

describe("Phase 5.11.4 Task 2 — Payment & Production Configuration Protection", () => {
  let customer;
  let customerToken;
  let owner;
  let toilet;

  beforeAll(async () => {
    // 1. Create test customer
    customer = await prisma.user.create({
      data: {
        fullName: "Security Test Customer",
        email: `sec_cust_${Date.now()}@example.com`,
        password: "hashedPassword123",
        role: "USER",
      },
    });

    customerToken = generateAccessToken({
      id: customer.id,
      email: customer.email,
      role: customer.role,
    });

    // 2. Create test owner and toilet
    owner = await prisma.user.create({
      data: {
        fullName: "Security Test Owner",
        email: `sec_owner_${Date.now()}@example.com`,
        password: "hashedPassword123",
        role: "OWNER",
      },
    });

    toilet = await prisma.toilet.create({
      data: {
        ownerId: owner.id,
        name: "Security Test Toilet",
        address: "100 Security Blvd",
        city: "Mumbai",
        state: "Maharashtra",
        country: "India",
        postalCode: "400001",
        price: 50.0,
        latitude: 19.076,
        longitude: 72.8777,
        qrToken: "QR_SEC_" + Date.now(),
        isAvailable: true,
      },
    });

    // Add operating hours
    const days = [
      "SUNDAY",
      "MONDAY",
      "TUESDAY",
      "WEDNESDAY",
      "THURSDAY",
      "FRIDAY",
      "SATURDAY",
    ];
    for (const day of days) {
      await prisma.operatingHours.upsert({
        where: { toiletId_day: { toiletId: toilet.id, day } },
        update: { isClosed: false, openingTime: "06:00", closingTime: "22:00" },
        create: {
          toiletId: toilet.id,
          day,
          isClosed: false,
          openingTime: "06:00",
          closingTime: "22:00",
        },
      });
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("1. Environment Variable Validation at Startup", () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    it("should pass validation when all required variables are present", () => {
      expect(() => validateEnv()).not.toThrow();
    });

    it("should fail validation if DATABASE_URL is missing", () => {
      delete process.env.DATABASE_URL;
      expect(() => validateEnv()).toThrow(/DATABASE_URL is required/);
    });

    it("should fail validation if JWT_ACCESS_SECRET is too short", () => {
      process.env.JWT_ACCESS_SECRET = "too-short";
      expect(() => validateEnv()).toThrow(/at least 32 characters/);
    });

    it("should fail validation in production if PAYMENT_MODE is 'mock'", () => {
      process.env.NODE_ENV = "production";
      process.env.PAYMENT_MODE = "mock";
      expect(() => validateEnv()).toThrow(
        /PAYMENT_MODE='mock' is strictly prohibited in production/
      );
    });
  });

  describe("2. Mock Payment Endpoints Production Protection", () => {
    let testBooking;

    beforeEach(async () => {
      testBooking = await prisma.booking.create({
        data: {
          userId: customer.id,
          toiletId: toilet.id,
          amount: 50.0,
          scheduledDate: new Date("2026-12-01"),
          startTime: new Date("2026-12-01T10:00:00Z"),
          endTime: new Date("2026-12-01T10:30:00Z"),
          token: "SG-SEC-" + Math.floor(100000 + Math.random() * 900000),
          status: "PENDING",
          payment: {
            create: {
              amount: 50.0,
              currency: "INR",
              paymentMethod: "UPI",
              paymentStatus: "PENDING",
            },
          },
        },
        include: { payment: true },
      });
    });

    it("should reject mock payment outcome with 403 when NODE_ENV is production", async () => {
      const origEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = "production";

        const res = await request(app)
          .post(`/api/bookings/${testBooking.id}/payment/mock-result`)
          .set("Authorization", `Bearer ${customerToken}`)
          .send({ outcome: "SUCCESS" });

        expect(res.status).toBe(403);
        expect(res.body.message).toMatch(/strictly disabled in production/);
      } finally {
        process.env.NODE_ENV = origEnv;
      }
    });

    it("should reject legacy direct payment endpoint with 403 when NODE_ENV is production", async () => {
      const origEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = "production";

        const res = await request(app)
          .post(`/api/bookings/${testBooking.id}/payments`)
          .set("Authorization", `Bearer ${customerToken}`)
          .send({ paymentMethod: "UPI" });

        expect(res.status).toBe(403);
        expect(res.body.message).toMatch(/strictly disabled in production/);
      } finally {
        process.env.NODE_ENV = origEnv;
      }
    });
  });

  describe("3. Untrusted Client Claims & Amount Tampering Protection", () => {
    it("should strictly ignore client-supplied amount or paymentStatus during booking creation", async () => {
      const res = await request(app)
        .post("/api/bookings")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          toiletId: toilet.id,
          scheduledDate: "2026-12-05",
          startTime: "11:00",
          endTime: "11:30",
          paymentMethod: "UPI",
          amount: 0.01, // Malicious tampering attempt
          paymentStatus: "SUCCESS", // Malicious claim
        });

      expect(res.status).toBe(201);
      const createdBooking = res.body.data;
      // Amount must be the toilet's verified price (50.0), NOT client's 0.01!
      expect(Number(createdBooking.payment.amount)).toBe(50.0);
      expect(createdBooking.status).toBe("PENDING");
      expect(createdBooking.payment.paymentStatus).toBe("PENDING");

      // Verify directly in database that booking.amount is 50.0
      const dbBooking = await prisma.booking.findUnique({
        where: { id: createdBooking.id },
      });
      expect(Number(dbBooking.amount)).toBe(50.0);
    });

    it("should reject initiatePayment when unknown client-supplied fields are passed", async () => {
      const testBooking = await prisma.booking.create({
        data: {
          userId: customer.id,
          toiletId: toilet.id,
          amount: 50.0,
          scheduledDate: new Date("2026-12-06"),
          startTime: new Date("2026-12-06T10:00:00Z"),
          endTime: new Date("2026-12-06T10:30:00Z"),
          token: "SG-SEC-" + Math.floor(100000 + Math.random() * 900000),
          status: "PENDING",
        },
      });

      const res = await request(app)
        .post(`/api/bookings/${testBooking.id}/payment`)
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          paymentMethod: "CARD",
          amount: 1.0, // Malicious field
          paymentStatus: "SUCCESS", // Malicious field
        });

      // Zod schema is .strict(), rejecting unrecognized keys
      expect(res.status).toBe(400);
    });
  });

  describe("4. Provider Signature Verification & Idempotency", () => {
    const webhookSecret = "test_webhook_secret_key_1234567890";
    let webhookBooking;

    beforeEach(async () => {
      process.env.PAYMENT_WEBHOOK_SECRET = webhookSecret;

      webhookBooking = await prisma.booking.create({
        data: {
          userId: customer.id,
          toiletId: toilet.id,
          amount: 50.0,
          scheduledDate: new Date("2026-12-10"),
          startTime: new Date("2026-12-10T14:00:00Z"),
          endTime: new Date("2026-12-10T14:30:00Z"),
          token: "SG-WH-" + Math.floor(100000 + Math.random() * 900000),
          status: "PENDING",
          payment: {
            create: {
              amount: 50.0,
              currency: "INR",
              paymentMethod: "UPI",
              paymentStatus: "PENDING",
            },
          },
        },
        include: { payment: true },
      });
    });

    const generateSignature = (payload, secret = webhookSecret) => {
      return crypto
        .createHmac("sha256", secret)
        .update(JSON.stringify(payload))
        .digest("hex");
    };

    it("should reject webhook request without a signature", async () => {
      const payload = {
        bookingId: webhookBooking.id,
        transactionId: "TXN_WEBHOOK_1",
        amount: 50.0,
        status: "SUCCESS",
      };

      const res = await request(app)
        .post("/api/payments/webhook")
        .send(payload);

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/signature is missing/);
    });

    it("should reject webhook request with an invalid signature", async () => {
      const payload = {
        bookingId: webhookBooking.id,
        transactionId: "TXN_WEBHOOK_2",
        amount: 50.0,
        status: "SUCCESS",
      };

      const res = await request(app)
        .post("/api/payments/webhook")
        .set("x-payment-signature", "invalid_signature_hex_1234567890123456789012345678901234567890123456789012345678901234")
        .send(payload);

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/Invalid webhook signature/);
    });

    it("should reject webhook request when amount does not match booking snapshot", async () => {
      const payload = {
        bookingId: webhookBooking.id,
        transactionId: "TXN_WEBHOOK_3",
        amount: 10.0, // Booking was 50.0!
        status: "SUCCESS",
      };

      const sig = generateSignature(payload);

      const res = await request(app)
        .post("/api/payments/webhook")
        .set("x-payment-signature", sig)
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Amount mismatch/);
    });

    it("should accept valid webhook, confirm booking atomically, and emit outbox event", async () => {
      const txId = "TXN_VALID_" + Date.now();
      const payload = {
        bookingId: webhookBooking.id,
        transactionId: txId,
        amount: 50.0,
        status: "SUCCESS",
      };

      const sig = generateSignature(payload);

      const res = await request(app)
        .post("/api/payments/webhook")
        .set("x-payment-signature", sig)
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("PROCESSED");

      // Verify DB state
      const updatedBooking = await prisma.booking.findUnique({
        where: { id: webhookBooking.id },
        include: { payment: true },
      });

      expect(updatedBooking.status).toBe("CONFIRMED");
      expect(updatedBooking.payment.paymentStatus).toBe("SUCCESS");
      expect(updatedBooking.payment.transactionId).toBe(txId);

      // Verify outbox event
      const outbox = await prisma.outboxEvent.findFirst({
        where: { aggregateId: webhookBooking.id, eventType: "payment.succeeded.v1" },
      });
      expect(outbox).not.toBeNull();
      expect(outbox.status).toBe("PENDING");
    });

    it("should be idempotent on duplicate webhook delivery with the same transactionId", async () => {
      const txId = "TXN_IDEMPOTENT_" + Date.now();
      const payload = {
        bookingId: webhookBooking.id,
        transactionId: txId,
        amount: 50.0,
        status: "SUCCESS",
      };

      const sig = generateSignature(payload);

      // First delivery
      const res1 = await request(app)
        .post("/api/payments/webhook")
        .set("x-payment-signature", sig)
        .send(payload);
      expect(res1.status).toBe(200);
      expect(res1.body.data.status).toBe("PROCESSED");

      // Duplicate replay
      const res2 = await request(app)
        .post("/api/payments/webhook")
        .set("x-payment-signature", sig)
        .send(payload);
      expect(res2.status).toBe(200);
      expect(res2.body.data.status).toBe("ALREADY_PROCESSED");
    });
  });
});
