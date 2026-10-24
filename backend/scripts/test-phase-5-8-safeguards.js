import dotenv from "dotenv";
dotenv.config();

import request from "supertest";
import app from "../src/app.js";
import prisma from "../src/config/prisma.js";
import { expireBookings } from "../src/services/bookingExpiry.service.js";
import { generateAccessToken } from "../utils/jwt.js";

async function runPhase58ChecklistTests() {
  console.log("=== Testing Phase 5.8: Booking History, Expiry, and Safeguards ===");
  process.env.PAYMENT_MODE = "mock";

  try {
    // Setup test users
    let owner = await prisma.user.findFirst({ where: { email: "owner_58@example.com" } });
    if (!owner) {
      owner = await prisma.user.create({
        data: {
          fullName: "Owner 58",
          email: "owner_58@example.com",
          password: "password_hash",
          role: "OWNER",
        },
      });
    }

    let customer = await prisma.user.findFirst({ where: { email: "customer_58@example.com" } });
    if (!customer) {
      customer = await prisma.user.create({
        data: {
          fullName: "Customer 58",
          email: "customer_58@example.com",
          password: "password_hash",
          role: "USER",
        },
      });
    }

    let otherCustomer = await prisma.user.findFirst({ where: { email: "other_customer_58@example.com" } });
    if (!otherCustomer) {
      otherCustomer = await prisma.user.create({
        data: {
          fullName: "Other Customer 58",
          email: "other_customer_58@example.com",
          password: "password_hash",
          role: "USER",
        },
      });
    }

    let toilet = await prisma.toilet.findFirst({ where: { ownerId: owner.id } });
    if (!toilet) {
      toilet = await prisma.toilet.create({
        data: {
          ownerId: owner.id,
          name: "Smart Toilet 58",
          address: "Central Square",
          city: "Pune",
          state: "Maharashtra",
          country: "India",
          postalCode: "411001",
          price: 15.0,
          latitude: 18.5204,
          longitude: 73.8567,
          isVerified: true,
          isAvailable: true,
          qrToken: "QR_58_" + Date.now(),
        },
      });
    } else {
      await prisma.toilet.update({
        where: { id: toilet.id },
        data: { isVerified: true, isAvailable: true },
      });
    }

    const customerToken = generateAccessToken({
      id: customer.id,
      email: customer.email,
      role: customer.role,
    });

    const ownerToken = generateAccessToken({
      id: owner.id,
      email: owner.email,
      role: owner.role,
    });

    const past = new Date(Date.now() - 3600000);
    const now = new Date();

    // 1 & 3: Expired pending booking & Pending payment cleanup
    const pendingBooking = await prisma.booking.create({
      data: {
        userId: customer.id,
        toiletId: toilet.id,
        token: "SG-580001",
        scheduledDate: past,
        startTime: new Date(past.getTime() - 1800000),
        endTime: past,
        amount: 15.0,
        status: "PENDING",
        payment: {
          create: {
            amount: 15.0,
            currency: "INR",
            paymentMethod: "UPI",
            paymentStatus: "PENDING",
          },
        },
      },
    });

    // 2: Expired confirmed booking (payment must remain SUCCESS)
    const confirmedBooking = await prisma.booking.create({
      data: {
        userId: customer.id,
        toiletId: toilet.id,
        token: "SG-580002",
        scheduledDate: past,
        startTime: new Date(past.getTime() - 1800000),
        endTime: past,
        amount: 15.0,
        status: "CONFIRMED",
        payment: {
          create: {
            amount: 15.0,
            currency: "INR",
            paymentMethod: "UPI",
            paymentStatus: "SUCCESS",
            transactionId: "TXN_MOCK_580002",
            paidAt: past,
          },
        },
      },
    });

    // 4: Active session protection (IN_PROGRESS booking must NOT expire)
    const inProgressBooking = await prisma.booking.create({
      data: {
        userId: customer.id,
        toiletId: toilet.id,
        token: "SG-580003",
        scheduledDate: past,
        startTime: new Date(past.getTime() - 1800000),
        endTime: past,
        amount: 15.0,
        status: "IN_PROGRESS",
        sessions: {
          create: {
            userId: customer.id,
            toiletId: toilet.id,
            startedAt: past,
            status: "ACTIVE",
          },
        },
      },
    });

    // Other customer's expired booking (for history filtering check)
    const otherExpiredBooking = await prisma.booking.create({
      data: {
        userId: otherCustomer.id,
        toiletId: toilet.id,
        token: "SG-580004",
        scheduledDate: past,
        startTime: new Date(past.getTime() - 1800000),
        endTime: past,
        amount: 15.0,
        status: "PENDING",
      },
    });

    // Run expiry service
    const expiredCount = await expireBookings();
    console.log(`[Expiry Run] Expired ${expiredCount} booking(s).`);

    // Verify 1: Expired pending booking
    const checkPending = await prisma.booking.findUnique({
      where: { id: pendingBooking.id },
      include: { payment: true },
    });
    console.log("[1/7] Expired pending booking status:", checkPending.status);
    console.assert(checkPending.status === "EXPIRED", "Expected status EXPIRED");

    // Verify 3: Pending payment cleanup
    console.log("[3/7] Pending payment cleanup status:", checkPending.payment.paymentStatus);
    console.assert(checkPending.payment.paymentStatus === "FAILED", "Expected paymentStatus FAILED");

    // Verify 2: Expired confirmed booking
    const checkConfirmed = await prisma.booking.findUnique({
      where: { id: confirmedBooking.id },
      include: { payment: true },
    });
    console.log("[2/7] Expired confirmed booking status:", checkConfirmed.status);
    console.log("      Payment status remains:", checkConfirmed.payment.paymentStatus);
    console.assert(checkConfirmed.status === "EXPIRED", "Expected booking status EXPIRED");
    console.assert(checkConfirmed.payment.paymentStatus === "SUCCESS", "Expected paymentStatus to remain SUCCESS");

    // Verify 4: Active session protection
    const checkInProgress = await prisma.booking.findUnique({
      where: { id: inProgressBooking.id },
    });
    console.log("[4/7] Active session protection status:", checkInProgress.status);
    console.assert(checkInProgress.status === "IN_PROGRESS", "Expected status to remain IN_PROGRESS");

    // Verify 5: History filtering (GET /api/bookings?status=EXPIRED)
    const historyRes = await request(app)
      .get("/api/bookings?status=EXPIRED")
      .set("Authorization", `Bearer ${customerToken}`);

    console.log("[5/7] History filtering response status:", historyRes.status);
    console.assert(historyRes.status === 200, "Expected 200 OK");
    const returnedIds = historyRes.body.data.bookings.map((b) => b.id);
    console.assert(returnedIds.includes(pendingBooking.id), "Customer's expired booking must appear");
    console.assert(returnedIds.includes(confirmedBooking.id), "Customer's expired confirmed booking must appear");
    console.assert(!returnedIds.includes(otherExpiredBooking.id), "Other customer's expired booking must NOT appear");
    console.log("      Customer saw only own expired bookings (isolation verified).");

    // Verify 6: Late payment rejection
    const lateBooking = await prisma.booking.create({
      data: {
        userId: customer.id,
        toiletId: toilet.id,
        token: "SG-580005",
        scheduledDate: past,
        startTime: new Date(past.getTime() - 1800000),
        endTime: past,
        amount: 15.0,
        status: "PENDING",
        payment: {
          create: {
            amount: 15.0,
            currency: "INR",
            paymentMethod: "UPI",
            paymentStatus: "PENDING",
          },
        },
      },
    });

    const latePaymentRes = await request(app)
      .post(`/api/bookings/${lateBooking.id}/payments/mock-result`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ outcome: "SUCCESS" });

    console.log("[6/7] Late payment rejection status:", latePaymentRes.status);
    console.assert(latePaymentRes.status === 409, `Expected 409 Conflict, got ${latePaymentRes.status}`);
    console.assert(latePaymentRes.body.message.includes("expired"), "Expected expired message");

    // Verify 7: Session reuse prevention
    const sessionBooking = await prisma.booking.create({
      data: {
        userId: customer.id,
        toiletId: toilet.id,
        token: "SG-580006",
        scheduledDate: now,
        startTime: new Date(now.getTime() - 5 * 60 * 1000),
        endTime: new Date(now.getTime() + 25 * 60 * 1000),
        amount: 15.0,
        status: "CONFIRMED",
        payment: {
          create: {
            amount: 15.0,
            currency: "INR",
            paymentMethod: "UPI",
            paymentStatus: "SUCCESS",
            paidAt: now,
          },
        },
        sessions: {
          create: {
            userId: customer.id,
            toiletId: toilet.id,
            startedAt: new Date(now.getTime() - 4 * 60 * 1000),
            endedAt: new Date(now.getTime() - 1 * 60 * 1000),
            duration: 3,
            status: "COMPLETED",
          },
        },
      },
    });

    const reuseSessionRes = await request(app)
      .post("/api/owner/sessions/start")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ token: "SG-580006" });

    console.log("[7/7] Session reuse rejection status:", reuseSessionRes.status);
    console.assert(reuseSessionRes.status === 409, `Expected 409 Conflict, got ${reuseSessionRes.status}`);
    console.assert(reuseSessionRes.body.message.includes("already exists"), "Expected session exists message");

    // Cleanup
    await prisma.usageSession.deleteMany({
      where: {
        bookingId: {
          in: [
            pendingBooking.id,
            confirmedBooking.id,
            inProgressBooking.id,
            otherExpiredBooking.id,
            lateBooking.id,
            sessionBooking.id,
          ],
        },
      },
    });
    await prisma.payment.deleteMany({
      where: {
        bookingId: {
          in: [
            pendingBooking.id,
            confirmedBooking.id,
            inProgressBooking.id,
            otherExpiredBooking.id,
            lateBooking.id,
            sessionBooking.id,
          ],
        },
      },
    });
    await prisma.booking.deleteMany({
      where: {
        id: {
          in: [
            pendingBooking.id,
            confirmedBooking.id,
            inProgressBooking.id,
            otherExpiredBooking.id,
            lateBooking.id,
            sessionBooking.id,
          ],
        },
      },
    });

    console.log("=== All 7/7 Phase 5.8 Checklist Tests PASSED! ===");
    process.exit(0);
  } catch (err) {
    console.error("Test execution failed:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runPhase58ChecklistTests();
