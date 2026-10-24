import dotenv from "dotenv";
dotenv.config();

import crypto from "crypto";
import request from "supertest";
import app from "../src/app.js";
import prisma from "../src/config/prisma.js";
import { generateAccessToken } from "../utils/jwt.js";

describe("Phase 6.6 — Razorpay Route (Direct Split at Checkout & Escrow Settlement)", () => {
  const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || "rzp_sec_sanitigo_dev_secret_2026";
  let customer;
  let customerToken;
  let ownerA;
  let ownerAToken;
  let ownerB;
  let ownerBToken;
  let toiletA;
  let toiletB;

  beforeAll(async () => {
    // 1. Create Customer
    customer = await prisma.user.create({
      data: {
        fullName: "Route Customer",
        email: `route_cust_${Date.now()}@example.com`,
        password: "hashedPassword123",
        role: "USER",
      },
    });
    customerToken = generateAccessToken({
      id: customer.id,
      email: customer.email,
      role: customer.role,
    });

    // 2. Create Owner A
    ownerA = await prisma.user.create({
      data: {
        fullName: "Toilet Owner Alpha",
        email: `owner_a_${Date.now()}@example.com`,
        password: "hashedPassword123",
        role: "OWNER",
      },
    });
    ownerAToken = generateAccessToken({
      id: ownerA.id,
      email: ownerA.email,
      role: ownerA.role,
    });

    // 3. Create Owner B
    ownerB = await prisma.user.create({
      data: {
        fullName: "Toilet Owner Beta",
        email: `owner_b_${Date.now()}@example.com`,
        password: "hashedPassword123",
        role: "OWNER",
      },
    });
    ownerBToken = generateAccessToken({
      id: ownerB.id,
      email: ownerB.email,
      role: ownerB.role,
    });

    // 4. Create Toilet A (owned by Owner A)
    toiletA = await prisma.toilet.create({
      data: {
        ownerId: ownerA.id,
        name: "Alpha Executive Restroom",
        address: "101 MG Road",
        city: "Bengaluru",
        state: "Karnataka",
        country: "India",
        postalCode: "560001",
        price: 100.0,
        latitude: 12.9716,
        longitude: 77.5946,
        qrToken: "QR_ALPHA_" + Date.now(),
        isAvailable: true,
        isVerified: true,
      },
    });

    // 5. Create Toilet B (owned by Owner B)
    toiletB = await prisma.toilet.create({
      data: {
        ownerId: ownerB.id,
        name: "Beta Metro Restroom",
        address: "202 Indiranagar",
        city: "Bengaluru",
        state: "Karnataka",
        country: "India",
        postalCode: "560038",
        price: 80.0,
        latitude: 12.9784,
        longitude: 77.6408,
        qrToken: "QR_BETA_" + Date.now(),
        isAvailable: true,
        isVerified: true,
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const createBookingForToilet = async (toiletTarget, price) => {
    const now = new Date();
    const startTime = new Date(now.getTime() - 5 * 60 * 1000);
    const endTime = new Date(now.getTime() + 60 * 60 * 1000);

    return prisma.booking.create({
      data: {
        userId: customer.id,
        toiletId: toiletTarget.id,
        amount: price,
        scheduledDate: now,
        startTime,
        endTime,
        token: "SG-" + Math.floor(100000 + Math.random() * 900000),
        status: "PENDING",
      },
      include: {
        toilet: { include: { owner: true } },
        payment: true,
      },
    });
  };

  const generateRazorpaySignature = (orderId, paymentId, secret = razorpayKeySecret) => {
    return crypto
      .createHmac("sha256", secret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");
  };

  it("1. Owner onboarding to Razorpay Route creates/links linked account; non-owners are rejected", async () => {
    // Regular customer cannot configure owner payout account
    const forbiddenRes = await request(app)
      .post("/api/payments/owner/payout-account")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ businessName: "Illegal Payout", payoutUpiId: "bad@upi" });
    expect(forbiddenRes.status).toBe(403);

    // Owner A links their Route account
    const resA = await request(app)
      .post("/api/payments/owner/payout-account")
      .set("Authorization", `Bearer ${ownerAToken}`)
      .send({ businessName: "Alpha Sanitation Services", payoutUpiId: "alpha@oksbi" });
    expect(resA.status).toBe(200);
    expect(resA.body.data.razorpayAccountId).toMatch(/^acc_/);
    expect(resA.body.data.payoutUpiId).toBe("alpha@oksbi");

    // Owner B links their Route account
    const resB = await request(app)
      .post("/api/payments/owner/payout-account")
      .set("Authorization", `Bearer ${ownerBToken}`)
      .send({ businessName: "Beta Clean Tech", payoutUpiId: "beta@icici" });
    expect(resB.status).toBe(200);
    expect(resB.body.data.razorpayAccountId).toMatch(/^acc_/);

    // Verify distinct account IDs are assigned
    expect(resA.body.data.razorpayAccountId).not.toBe(resB.body.data.razorpayAccountId);
  });

  it("2. Customer paying for Toilet A routes split payment strictly to Owner A with escrow on_hold", async () => {
    const bookingA = await createBookingForToilet(toiletA, 100.0);

    const orderRes = await request(app)
      .post(`/api/bookings/${bookingA.id}/payment/razorpay-order`)
      .set("Authorization", `Bearer ${customerToken}`);

    expect(orderRes.status).toBe(201);
    const data = orderRes.body.data;

    // Verify amount conversions: ₹100 = 10000 paise
    expect(data.amount).toBe(100.0);
    expect(data.amountInPaise).toBe(10000);

    // Verify split details
    expect(data.split.onHold).toBe(true);
    expect(data.split.transferStatus).toBe("HELD");

    // Owner gets 90% (₹90 = 9000 paise); Platform fee is 10% (₹10 = 1000 paise)
    expect(data.split.ownerShare).toBe(90.0);
    expect(data.split.ownerShareInPaise).toBe(9000);
    expect(data.split.platformFee).toBe(10.0);
    expect(data.split.platformFeeInPaise).toBe(1000);

    // CRITICAL: Account destination must match Owner A and NEVER Owner B
    const freshOwnerA = await prisma.user.findUnique({ where: { id: ownerA.id } });
    const freshOwnerB = await prisma.user.findUnique({ where: { id: ownerB.id } });
    expect(data.split.ownerAccountId).toBe(freshOwnerA.razorpayAccountId);
    expect(data.split.ownerAccountId).not.toBe(freshOwnerB.razorpayAccountId);

    // Verify DB Payment record
    const payment = await prisma.payment.findUnique({ where: { bookingId: bookingA.id } });
    expect(Number(payment.ownerShare)).toBe(90.0);
    expect(Number(payment.platformFee)).toBe(10.0);
    expect(payment.transferStatus).toBe("HELD");
  });

  it("3. Customer paying for Toilet B routes split payment strictly to Owner B", async () => {
    const bookingB = await createBookingForToilet(toiletB, 80.0);

    const orderRes = await request(app)
      .post(`/api/bookings/${bookingB.id}/payment/razorpay-order`)
      .set("Authorization", `Bearer ${customerToken}`);

    expect(orderRes.status).toBe(201);
    const data = orderRes.body.data;

    // 90% of ₹80 = ₹72 (7200 paise); 10% = ₹8 (800 paise)
    expect(data.split.ownerShare).toBe(72.0);
    expect(data.split.ownerShareInPaise).toBe(7200);
    expect(data.split.platformFee).toBe(8.0);
    expect(data.split.platformFeeInPaise).toBe(800);

    const freshOwnerB = await prisma.user.findUnique({ where: { id: ownerB.id } });
    expect(data.split.ownerAccountId).toBe(freshOwnerB.razorpayAccountId);
  });

  it("4. Completing usage session releases the escrow hold, settling transferStatus to SETTLED", async () => {
    const booking = await createBookingForToilet(toiletA, 100.0);

    // 1. Create order
    const orderRes = await request(app)
      .post(`/api/bookings/${booking.id}/payment/razorpay-order`)
      .set("Authorization", `Bearer ${customerToken}`);
    const orderId = orderRes.body.data.orderId;
    const paymentId = "pay_escrow_" + Date.now();

    // 2. Complete payment
    await request(app)
      .post(`/api/bookings/${booking.id}/payment/razorpay-verify`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: generateRazorpaySignature(orderId, paymentId),
      });

    // Pre-condition: Payment is SUCCESS, transfer is HELD
    let payment = await prisma.payment.findUnique({ where: { bookingId: booking.id } });
    expect(payment.paymentStatus).toBe("SUCCESS");
    expect(payment.transferStatus).toBe("HELD");

    // 3. Start Usage Session (Owner A)
    const startRes = await request(app)
      .post("/api/owner/sessions/start")
      .set("Authorization", `Bearer ${ownerAToken}`)
      .send({ token: booking.token });
    expect(startRes.status).toBe(201);
    const sessionId = startRes.body.data.session.id;

    // 4. End Usage Session (Owner A)
    const endRes = await request(app)
      .patch(`/api/owner/sessions/${sessionId}/end`)
      .set("Authorization", `Bearer ${ownerAToken}`);
    expect(endRes.status).toBe(200);

    // Post-condition: Escrow hold released, transferStatus is SETTLED
    payment = await prisma.payment.findUnique({ where: { bookingId: booking.id } });
    expect(payment.transferStatus).toBe("SETTLED");
  });

  it("5. Cancelling paid booking reverses the Route transfer, setting transferStatus to REVERSED", async () => {
    const booking = await createBookingForToilet(toiletA, 100.0);

    // 1. Create order and pay
    const orderRes = await request(app)
      .post(`/api/bookings/${booking.id}/payment/razorpay-order`)
      .set("Authorization", `Bearer ${customerToken}`);
    const orderId = orderRes.body.data.orderId;
    const paymentId = "pay_cancel_" + Date.now();

    await request(app)
      .post(`/api/bookings/${booking.id}/payment/razorpay-verify`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: generateRazorpaySignature(orderId, paymentId),
      });

    // 2. Cancel the paid booking
    const cancelRes = await request(app)
      .patch(`/api/v1/bookings/${booking.id}/cancel`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ reason: "Plans changed" });
    expect(cancelRes.status).toBe(200);

    // Verify DB Payment state: payment marked REFUNDED and transferStatus marked REVERSED
    const payment = await prisma.payment.findUnique({ where: { bookingId: booking.id } });
    expect(payment.paymentStatus).toBe("REFUNDED");
    expect(payment.transferStatus).toBe("REVERSED");
  });
});
