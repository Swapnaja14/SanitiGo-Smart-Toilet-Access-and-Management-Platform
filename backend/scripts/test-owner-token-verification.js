import dotenv from "dotenv";
dotenv.config();

import request from "supertest";
import app from "../src/app.js";
import prisma from "../src/config/prisma.js";
import { generateAccessToken } from "../utils/jwt.js";

async function runOwnerVerificationTests() {
  console.log("=== Testing Phase 5.6: Owner Token Verification ===");

  try {
    // 1. Setup Owner 1, Owner 2, Customer
    let owner1 = await prisma.user.findFirst({
      where: { email: "owner1_56@example.com" },
    });
    if (!owner1) {
      owner1 = await prisma.user.create({
        data: {
          fullName: "Owner One",
          email: "owner1_56@example.com",
          password: "password_hash",
          role: "OWNER",
        },
      });
    }

    let owner2 = await prisma.user.findFirst({
      where: { email: "owner2_56@example.com" },
    });
    if (!owner2) {
      owner2 = await prisma.user.create({
        data: {
          fullName: "Owner Two",
          email: "owner2_56@example.com",
          password: "password_hash",
          role: "OWNER",
        },
      });
    }

    let customer = await prisma.user.findFirst({
      where: { email: "customer_56@example.com" },
    });
    if (!customer) {
      customer = await prisma.user.create({
        data: {
          fullName: "Customer User",
          email: "customer_56@example.com",
          password: "password_hash",
          role: "USER",
        },
      });
    }

    let toilet = await prisma.toilet.findFirst({
      where: { ownerId: owner1.id },
    });
    if (!toilet) {
      toilet = await prisma.toilet.create({
        data: {
          ownerId: owner1.id,
          name: "Smart Restroom 56",
          address: "Sector 5",
          city: "Pune",
          state: "Maharashtra",
          country: "India",
          postalCode: "411001",
          price: 20.0,
          latitude: 18.5204,
          longitude: 73.8567,
          qrToken: "QR_56_" + Date.now(),
        },
      });
    }

    const owner1Token = generateAccessToken({
      id: owner1.id,
      email: owner1.email,
      role: owner1.role,
    });

    const owner2Token = generateAccessToken({
      id: owner2.id,
      email: owner2.email,
      role: owner2.role,
    });

    const customerToken = generateAccessToken({
      id: customer.id,
      email: customer.email,
      role: customer.role,
    });

    const now = new Date();
    // Booking active right now (started 5 mins ago, ends in 25 mins)
    const validBooking = await prisma.booking.create({
      data: {
        userId: customer.id,
        toiletId: toilet.id,
        token: "SG-560001",
        scheduledDate: now,
        startTime: new Date(now.getTime() - 5 * 60 * 1000),
        endTime: new Date(now.getTime() + 25 * 60 * 1000),
        amount: 20.0,
        status: "CONFIRMED",
        payment: {
          create: {
            amount: 20.0,
            currency: "INR",
            paymentMethod: "UPI",
            paymentStatus: "SUCCESS",
            transactionId: "TXN_MOCK_560001",
            paidAt: now,
          },
        },
      },
    });

    // Test 1: Successful verification by actual toilet owner
    const res1 = await request(app)
      .post("/api/owner/verify-token")
      .set("Authorization", `Bearer ${owner1Token}`)
      .send({ token: "SG-560001" });

    console.log("1. Successful verification status:", res1.status);
    console.assert(res1.status === 200, "Expected 200 OK");
    console.assert(res1.body.data.verified === true, "Expected verified: true");
    console.assert(res1.body.data.booking.toilet.name === "Smart Restroom 56", "Expected toilet details");
    console.log("   -> Verified message:", res1.body.message);

    // Test 2: Reject verification by another owner (Owner 2)
    const res2 = await request(app)
      .post("/api/owner/verify-token")
      .set("Authorization", `Bearer ${owner2Token}`)
      .send({ token: "SG-560001" });

    console.log("2. Cross-owner verification rejection status:", res2.status);
    console.assert(res2.status === 403, "Expected 403 Forbidden for wrong owner");
    console.assert(res2.body.message.includes("not authorized"), "Expected authorization message");

    // Test 3: Reject non-owner role (Customer attempting to verify)
    const res3 = await request(app)
      .post("/api/owner/verify-token")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ token: "SG-560001" });

    console.log("3. Role check (customer blocked) status:", res3.status);
    console.assert(res3.status === 403, "Expected 403 for non-OWNER role");

    // Test 4: Reject invalid token format
    const res4 = await request(app)
      .post("/api/owner/verify-token")
      .set("Authorization", `Bearer ${owner1Token}`)
      .send({ token: "INVALID-TOKEN" });

    console.log("4. Invalid token format rejection status:", res4.status);
    console.assert(res4.status === 400, "Expected 400 for bad format");

    // Test 5: Reject non-existent token
    const res5 = await request(app)
      .post("/api/owner/verify-token")
      .set("Authorization", `Bearer ${owner1Token}`)
      .send({ token: "SG-999999" });

    console.log("5. Non-existent token status:", res5.status);
    console.assert(res5.status === 404, "Expected 404 for non-existent token");

    // Test 6: Reject expired booking access window
    const expiredBooking = await prisma.booking.create({
      data: {
        userId: customer.id,
        toiletId: toilet.id,
        token: "SG-560002",
        scheduledDate: new Date(now.getTime() - 2 * 60 * 60 * 1000),
        startTime: new Date(now.getTime() - 2 * 60 * 60 * 1000),
        endTime: new Date(now.getTime() - 1 * 60 * 60 * 1000),
        amount: 20.0,
        status: "CONFIRMED",
        payment: {
          create: {
            amount: 20.0,
            currency: "INR",
            paymentMethod: "UPI",
            paymentStatus: "SUCCESS",
            transactionId: "TXN_MOCK_560002",
            paidAt: now,
          },
        },
      },
    });

    const res6 = await request(app)
      .post("/api/owner/verify-token")
      .set("Authorization", `Bearer ${owner1Token}`)
      .send({ token: "SG-560002" });

    console.log("6. Expired access window status:", res6.status);
    console.assert(res6.status === 409, "Expected 409 for expired access window");
    console.assert(res6.body.message.includes("expired"), "Expected expired message");

    // Test 7: Reject unpaid booking (Test D)
    const unpaidBooking = await prisma.booking.create({
      data: {
        userId: customer.id,
        toiletId: toilet.id,
        token: "SG-560003",
        scheduledDate: now,
        startTime: new Date(now.getTime() - 5 * 60 * 1000),
        endTime: new Date(now.getTime() + 25 * 60 * 1000),
        amount: 20.0,
        status: "CONFIRMED",
      },
    });

    const res7 = await request(app)
      .post("/api/owner/verify-token")
      .set("Authorization", `Bearer ${owner1Token}`)
      .send({ token: "SG-560003" });

    console.log("7. Unpaid booking rejection status:", res7.status);
    console.assert(res7.status === 409, "Expected 409 for unpaid booking");
    console.assert(res7.body.message.includes("Payment has not been confirmed"), "Expected payment error message");

    // Cleanup
    await prisma.payment.deleteMany({
      where: { bookingId: { in: [validBooking.id, expiredBooking.id] } },
    });
    await prisma.booking.deleteMany({
      where: { id: { in: [validBooking.id, expiredBooking.id, unpaidBooking.id] } },
    });

    console.log("=== All Phase 5.6 Owner Token Verification Tests (A-F) PASSED! ===");
    process.exit(0);
  } catch (err) {
    console.error("Test execution failed:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runOwnerVerificationTests();
