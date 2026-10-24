import dotenv from "dotenv";
dotenv.config();

import request from "supertest";
import app from "../src/app.js";
import prisma from "../src/config/prisma.js";
import { generateAccessToken } from "../utils/jwt.js";

async function runCustomerBookingTests() {
  console.log("=== Testing Phase 5.5: Customer Booking APIs ===");

  try {
    // 1. Setup Customer and Toilet
    let customerA = await prisma.user.findFirst({
      where: { email: "customer_a_55@example.com" },
    });
    if (!customerA) {
      customerA = await prisma.user.create({
        data: {
          fullName: "Customer A",
          email: "customer_a_55@example.com",
          password: "test_password_hash",
          role: "USER",
        },
      });
    }

    let customerB = await prisma.user.findFirst({
      where: { email: "customer_b_55@example.com" },
    });
    if (!customerB) {
      customerB = await prisma.user.create({
        data: {
          fullName: "Customer B",
          email: "customer_b_55@example.com",
          password: "test_password_hash",
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
          fullName: "Owner User",
          email: "owner_55@example.com",
          password: "test_password_hash",
          role: "OWNER",
        },
      });
    }

    let toilet = await prisma.toilet.findFirst({
      where: { ownerId: owner.id },
    });
    if (!toilet) {
      toilet = await prisma.toilet.create({
        data: {
          ownerId: owner.id,
          name: "Station Deluxe",
          address: "Central Wing",
          city: "Mumbai",
          state: "Maharashtra",
          country: "India",
          postalCode: "400001",
          price: 25.0,
          latitude: 18.9696,
          longitude: 72.8194,
          qrToken: "QR_55_" + Date.now(),
        },
      });
    }

    const tokenA = generateAccessToken({
      id: customerA.id,
      email: customerA.email,
      role: customerA.role,
    });

    const tokenB = generateAccessToken({
      id: customerB.id,
      email: customerB.email,
      role: customerB.role,
    });

    // 2. Create test bookings for Customer A
    const booking1 = await prisma.booking.create({
      data: {
        userId: customerA.id,
        toiletId: toilet.id,
        scheduledDate: new Date("2026-11-20T00:00:00.000Z"),
        startTime: new Date("2026-11-20T10:00:00.000Z"),
        endTime: new Date("2026-11-20T10:30:00.000Z"),
        amount: 25.0,
        status: "PENDING",
        payment: {
          create: {
            amount: 25.0,
            currency: "INR",
            paymentMethod: "UPI",
            paymentStatus: "PENDING",
          },
        },
      },
      include: { payment: true },
    });

    const paidBooking = await prisma.booking.create({
      data: {
        userId: customerA.id,
        toiletId: toilet.id,
        scheduledDate: new Date("2026-11-20T00:00:00.000Z"),
        startTime: new Date("2026-11-20T11:00:00.000Z"),
        endTime: new Date("2026-11-20T11:30:00.000Z"),
        amount: 25.0,
        status: "CONFIRMED",
        payment: {
          create: {
            amount: 25.0,
            currency: "INR",
            paymentMethod: "CARD",
            paymentStatus: "SUCCESS",
            transactionId: "TXN_PAID_55",
            paidAt: new Date(),
          },
        },
      },
      include: { payment: true },
    });

    // Test 1: GET /api/bookings (List bookings with pagination)
    const listRes = await request(app)
      .get("/api/bookings?page=1&limit=5")
      .set("Authorization", `Bearer ${tokenA}`);

    console.log("1. GET /api/bookings status:", listRes.status);
    console.assert(listRes.status === 200, "Expected 200 on list bookings");
    console.assert(listRes.body.data.bookings.length >= 2, "Expected at least 2 bookings for Customer A");
    console.assert(listRes.body.data.pagination.page === 1, "Expected page 1");
    console.log("   -> Retrieved bookings count:", listRes.body.data.bookings.length);
    console.log("   -> Pagination:", listRes.body.data.pagination);

    // Test 2: Pagination validation
    const invalidPageRes = await request(app)
      .get("/api/bookings?page=0&limit=10")
      .set("Authorization", `Bearer ${tokenA}`);
    console.log("2. GET /api/bookings with invalid page status:", invalidPageRes.status);
    console.assert(invalidPageRes.status === 400, "Expected 400 on invalid page");

    // Test 3: GET /api/bookings/:bookingId (View booking details)
    const detailRes = await request(app)
      .get(`/api/bookings/${booking1.id}`)
      .set("Authorization", `Bearer ${tokenA}`);

    console.log("3. GET /api/bookings/:bookingId status:", detailRes.status);
    console.assert(detailRes.status === 200, "Expected 200 on view booking");
    console.assert(detailRes.body.data.id === booking1.id, "Expected matching booking ID");
    console.assert(detailRes.body.data.toilet.name === "Station Deluxe", "Expected toilet details");
    console.log("   -> Booking details verified for toilet:", detailRes.body.data.toilet.name);

    // Test 4: Cross-customer isolation (Customer B viewing Customer A's booking)
    const crossViewRes = await request(app)
      .get(`/api/bookings/${booking1.id}`)
      .set("Authorization", `Bearer ${tokenB}`);

    console.log("4. Cross-customer GET status:", crossViewRes.status);
    console.assert(crossViewRes.status === 404, "Expected 404 Booking not found for other user");

    // Test 5: PATCH /api/bookings/:bookingId/cancel (Cancel PENDING booking)
    const cancelRes = await request(app)
      .patch(`/api/bookings/${booking1.id}/cancel`)
      .set("Authorization", `Bearer ${tokenA}`);

    console.log("5. PATCH /api/bookings/:bookingId/cancel status:", cancelRes.status);
    console.assert(cancelRes.status === 200, "Expected 200 on cancel");
    console.assert(cancelRes.body.data.status === "CANCELLED", "Expected status CANCELLED");

    // Verify unpaid mock payment invalidated
    const dbPayment = await prisma.payment.findUnique({
      where: { bookingId: booking1.id },
    });
    console.assert(dbPayment.paymentStatus === "FAILED", "Expected paymentStatus FAILED for invalidated payment");
    console.log("   -> Pending payment successfully invalidated to FAILED");

    // Test 6: Reject cancelling already cancelled booking
    const reCancelRes = await request(app)
      .patch(`/api/bookings/${booking1.id}/cancel`)
      .set("Authorization", `Bearer ${tokenA}`);

    console.log("6. Reject cancelling already cancelled booking status:", reCancelRes.status);
    console.assert(reCancelRes.status === 400, "Expected 400 on already cancelled booking");

    // Test 7: Reject cancelling paid booking
    const cancelPaidRes = await request(app)
      .patch(`/api/bookings/${paidBooking.id}/cancel`)
      .set("Authorization", `Bearer ${tokenA}`);

    console.log("7. Reject cancelling paid booking status:", cancelPaidRes.status);
    console.assert(cancelPaidRes.status === 409, "Expected 409 conflict for cancelling paid booking");
    console.assert(cancelPaidRes.body.message.includes("paid"), "Expected refund guidance in message");
    console.log("   -> Error message:", cancelPaidRes.body.message);

    // Cleanup
    await prisma.payment.deleteMany({ where: { bookingId: { in: [booking1.id, paidBooking.id] } } });
    await prisma.booking.deleteMany({ where: { id: { in: [booking1.id, paidBooking.id] } } });
    console.log("Cleaned up test records.");

    console.log("=== All Phase 5.5 Customer Booking Tests PASSED! ===");
    process.exit(0);
  } catch (err) {
    console.error("Test execution failed:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runCustomerBookingTests();
