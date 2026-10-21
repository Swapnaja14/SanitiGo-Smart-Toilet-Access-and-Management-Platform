import dotenv from "dotenv";
dotenv.config();

import request from "supertest";
import app from "../src/app.js";
import prisma from "../src/config/prisma.js";
import { generateAccessToken } from "../utils/jwt.js";

async function runPaymentWorkflowTest() {
  console.log("=== Testing Phase 5.4: Payment Workflow ===");

  try {
    // 1. Setup test customer and toilet
    let testCustomer = await prisma.user.findFirst({
      where: { email: "phase54_customer@example.com" },
    });
    if (!testCustomer) {
      testCustomer = await prisma.user.create({
        data: {
          fullName: "Payment Test Customer",
          email: "phase54_customer@example.com",
          password: "hashed_password",
          role: "USER",
        },
      });
    }

    let testOwner = await prisma.user.findFirst({
      where: { email: "phase54_owner@example.com" },
    });
    if (!testOwner) {
      testOwner = await prisma.user.create({
        data: {
          fullName: "Payment Test Owner",
          email: "phase54_owner@example.com",
          password: "hashed_password",
          role: "OWNER",
        },
      });
    }

    let testToilet = await prisma.toilet.findFirst({
      where: { ownerId: testOwner.id },
    });
    if (!testToilet) {
      testToilet = await prisma.toilet.create({
        data: {
          ownerId: testOwner.id,
          name: "Payment Test Toilet",
          address: "123 Clean Way",
          city: "Pune",
          state: "Maharashtra",
          country: "India",
          postalCode: "411001",
          price: 15.0,
          latitude: 18.5204,
          longitude: 73.8567,
          qrToken: "QR_TEST_" + Date.now(),
        },
      });
    }

    const token = generateAccessToken({
      id: testCustomer.id,
      email: testCustomer.email,
      role: testCustomer.role,
    });

    // 2. Create a test booking
    const booking = await prisma.booking.create({
      data: {
        userId: testCustomer.id,
        toiletId: testToilet.id,
        scheduledDate: new Date("2026-11-01T00:00:00.000Z"),
        startTime: new Date("2026-11-01T10:00:00.000Z"),
        endTime: new Date("2026-11-01T10:30:00.000Z"),
        amount: 15.0,
        status: "PENDING",
      },
    });
    console.log("Created test booking:", booking.id);

    // 3. Step 1: Initiate payment (POST /api/bookings/:bookingId/payment)
    const initRes = await request(app)
      .post(`/api/bookings/${booking.id}/payment`)
      .set("Authorization", `Bearer ${token}`)
      .send({ paymentMethod: "UPI" });

    console.log("1. Initiate Payment response status:", initRes.status);
    console.assert(initRes.status === 201, "Expected 201 on initiate payment");
    console.assert(initRes.body.data.paymentStatus === "PENDING", "Expected PENDING status");
    console.log("   -> Payment initialized as PENDING with amount:", initRes.body.data.amount);

    // 4. Step 2: Simulate FAILED outcome (POST /api/bookings/:bookingId/payment/mock-result)
    const failRes = await request(app)
      .post(`/api/bookings/${booking.id}/payment/mock-result`)
      .set("Authorization", `Bearer ${token}`)
      .send({ outcome: "FAILED" });

    console.log("2. Simulate FAILED outcome response status:", failRes.status);
    console.assert(failRes.status === 200, "Expected 200 on mock result");
    console.assert(failRes.body.data.payment.paymentStatus === "FAILED", "Expected FAILED payment status");
    console.assert(failRes.body.data.bookingStatus === "PENDING", "Booking should remain PENDING");
    console.log("   -> Payment successfully updated to FAILED and booking remains PENDING for retry");

    // 5. Step 3: Retry payment initiation
    const retryRes = await request(app)
      .post(`/api/bookings/${booking.id}/payment`)
      .set("Authorization", `Bearer ${token}`)
      .send({ paymentMethod: "CARD" });

    console.log("3. Retry Payment response status:", retryRes.status);
    console.assert(retryRes.status === 201, "Expected 201 on retry payment");
    console.assert(retryRes.body.data.paymentStatus === "PENDING", "Expected payment reset to PENDING");
    console.assert(retryRes.body.data.paymentMethod === "CARD", "Expected updated payment method");
    console.log("   -> Payment reset to PENDING for retry");

    // 6. Step 4: Simulate SUCCESS outcome
    const successRes = await request(app)
      .post(`/api/bookings/${booking.id}/payment/mock-result`)
      .set("Authorization", `Bearer ${token}`)
      .send({ outcome: "SUCCESS" });

    console.log("4. Simulate SUCCESS outcome response status:", successRes.status);
    console.assert(successRes.status === 200, "Expected 200 on mock success");
    console.assert(successRes.body.data.payment.paymentStatus === "SUCCESS", "Expected SUCCESS payment status");
    console.assert(successRes.body.data.bookingStatus === "CONFIRMED", "Booking should become CONFIRMED");
    console.assert(successRes.body.data.payment.transactionId.startsWith("MOCK-"), "Expected MOCK transactionId");
    console.log("   -> Payment SUCCESS and booking CONFIRMED with Transaction ID:", successRes.body.data.payment.transactionId);

    // 7. Step 5: View payment status (GET /api/bookings/:bookingId/payment)
    const getRes = await request(app)
      .get(`/api/bookings/${booking.id}/payment`)
      .set("Authorization", `Bearer ${token}`);

    console.log("5. Get Payment status response status:", getRes.status);
    console.assert(getRes.status === 200, "Expected 200 on get payment status");
    console.assert(getRes.body.data.payment.paymentStatus === "SUCCESS", "Expected SUCCESS in GET");
    console.assert(getRes.body.data.bookingStatus === "CONFIRMED", "Expected CONFIRMED in GET");
    console.log("   -> GET status correctly returned:", getRes.body.data);

    // 8. Step 6: Verify safety guards (cannot change SUCCESS to FAILED)
    const guardRes = await request(app)
      .post(`/api/bookings/${booking.id}/payment/mock-result`)
      .set("Authorization", `Bearer ${token}`)
      .send({ outcome: "FAILED" });

    console.log("6. Guard check: cannot change SUCCESS to FAILED:", guardRes.status);
    console.assert(guardRes.status === 409, "Expected 409 conflict");

    // 7. Cross-customer isolation (Other customer cannot view or initiate payment)
    const otherToken = generateAccessToken({
      id: "another_user_id_999",
      email: "another_user@example.com",
      role: "USER",
    });

    const crossGet = await request(app)
      .get(`/api/bookings/${booking.id}/payment`)
      .set("Authorization", `Bearer ${otherToken}`);
    console.log("7. Cross-customer GET other's booking status:", crossGet.status);
    console.assert(crossGet.status === 404, "Expected 404 Booking not found for another user");

    const crossInit = await request(app)
      .post(`/api/bookings/${booking.id}/payment`)
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ paymentMethod: "UPI" });
    console.log("8. Cross-customer POST initiate on other's booking status:", crossInit.status);
    console.assert(crossInit.status === 404, "Expected 404 Booking not found for another user");

    // Cleanup
    await prisma.payment.deleteMany({ where: { bookingId: booking.id } });
    await prisma.booking.delete({ where: { id: booking.id } });
    console.log("Cleaned up test booking and payment.");

    console.log("=== All Phase 5.4 Payment Workflow Tests PASSED! ===");
    process.exit(0);
  } catch (err) {
    console.error("Test failed:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runPaymentWorkflowTest();
