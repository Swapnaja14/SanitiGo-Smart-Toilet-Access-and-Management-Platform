import dotenv from "dotenv";
dotenv.config();

import request from "supertest";
import app from "../src/app.js";
import prisma from "../src/config/prisma.js";
import { generateAccessToken } from "../utils/jwt.js";

async function verifyChecklist() {
  console.log("==========================================================");
  console.log(" SanitiGo — Phase 5.5 Final Verification Checklist Test");
  console.log("==========================================================");

  const checklistResults = {};

  try {
    // Setup test users
    let customerA = await prisma.user.findFirst({
      where: { email: "checklist_cust_a@example.com" },
    });
    if (!customerA) {
      customerA = await prisma.user.create({
        data: {
          fullName: "Checklist Customer A",
          email: "checklist_cust_a@example.com",
          password: "password_hash",
          role: "USER",
        },
      });
    }

    let customerB = await prisma.user.findFirst({
      where: { email: "checklist_cust_b@example.com" },
    });
    if (!customerB) {
      customerB = await prisma.user.create({
        data: {
          fullName: "Checklist Customer B",
          email: "checklist_cust_b@example.com",
          password: "password_hash",
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
          fullName: "Checklist Owner",
          email: "checklist_owner@example.com",
          password: "password_hash",
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
          name: "Grand Restroom",
          address: "Gateway Plaza",
          city: "Mumbai",
          state: "Maharashtra",
          country: "India",
          postalCode: "400001",
          price: 30.0,
          latitude: 18.9696,
          longitude: 72.8194,
          qrToken: "QR_CHK_" + Date.now(),
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

    // Create test bookings
    // 1. Pending booking with pending payment
    const pendingBooking = await prisma.booking.create({
      data: {
        userId: customerA.id,
        toiletId: toilet.id,
        token: "SG-CHK-01",
        scheduledDate: new Date("2026-11-25T00:00:00.000Z"),
        startTime: new Date("2026-11-25T10:00:00.000Z"),
        endTime: new Date("2026-11-25T10:30:00.000Z"),
        amount: 30.0,
        status: "PENDING",
        payment: {
          create: {
            amount: 30.0,
            currency: "INR",
            paymentMethod: "UPI",
            paymentStatus: "PENDING",
          },
        },
      },
    });

    // 2. Paid / confirmed booking
    const paidBooking = await prisma.booking.create({
      data: {
        userId: customerA.id,
        toiletId: toilet.id,
        token: "SG-CHK-02",
        scheduledDate: new Date("2026-11-25T00:00:00.000Z"),
        startTime: new Date("2026-11-25T11:00:00.000Z"),
        endTime: new Date("2026-11-25T11:30:00.000Z"),
        amount: 30.0,
        status: "CONFIRMED",
        payment: {
          create: {
            amount: 30.0,
            currency: "INR",
            paymentMethod: "CARD",
            paymentStatus: "SUCCESS",
            transactionId: "TXN_CHK_PAID",
            paidAt: new Date(),
          },
        },
      },
    });

    // 3. Completed booking
    const completedBooking = await prisma.booking.create({
      data: {
        userId: customerA.id,
        toiletId: toilet.id,
        token: "SG-CHK-03",
        scheduledDate: new Date("2026-11-25T00:00:00.000Z"),
        startTime: new Date("2026-11-25T12:00:00.000Z"),
        endTime: new Date("2026-11-25T12:30:00.000Z"),
        amount: 30.0,
        status: "COMPLETED",
      },
    });

    // 4. In-progress booking
    const inProgressBooking = await prisma.booking.create({
      data: {
        userId: customerA.id,
        toiletId: toilet.id,
        token: "SG-CHK-04",
        scheduledDate: new Date("2026-11-25T00:00:00.000Z"),
        startTime: new Date("2026-11-25T13:00:00.000Z"),
        endTime: new Date("2026-11-25T13:30:00.000Z"),
        amount: 30.0,
        status: "IN_PROGRESS",
      },
    });

    // CHECK 1: List my bookings and pagination work
    const listRes = await request(app)
      .get("/api/bookings?page=1&limit=2")
      .set("Authorization", `Bearer ${tokenA}`);
    const badPageRes = await request(app)
      .get("/api/bookings?page=0")
      .set("Authorization", `Bearer ${tokenA}`);
    checklistResults["List my bookings and pagination work"] =
      listRes.status === 200 &&
      listRes.body.data.pagination.page === 1 &&
      listRes.body.data.pagination.limit === 2 &&
      badPageRes.status === 400;

    // CHECK 2: View my own booking details
    const viewRes = await request(app)
      .get(`/api/bookings/${pendingBooking.id}`)
      .set("Authorization", `Bearer ${tokenA}`);
    checklistResults["View my own booking details"] =
      viewRes.status === 200 &&
      viewRes.body.data.id === pendingBooking.id &&
      viewRes.body.data.toilet !== undefined &&
      viewRes.body.data.payment !== undefined &&
      Array.isArray(viewRes.body.data.sessions);

    // CHECK 3: Cannot view another customer's booking
    const crossViewRes = await request(app)
      .get(`/api/bookings/${pendingBooking.id}`)
      .set("Authorization", `Bearer ${tokenB}`);
    checklistResults["Cannot view another customer's booking"] =
      crossViewRes.status === 404;

    // CHECK 4: Cancel a pending booking successfully
    const cancelRes = await request(app)
      .patch(`/api/bookings/${pendingBooking.id}/cancel`)
      .set("Authorization", `Bearer ${tokenA}`);
    checklistResults["Cancel a pending booking successfully"] =
      cancelRes.status === 200 &&
      cancelRes.body.data.status === "CANCELLED";

    // CHECK 5: Cannot cancel a completed or in-progress booking
    const cancelCompRes = await request(app)
      .patch(`/api/bookings/${completedBooking.id}/cancel`)
      .set("Authorization", `Bearer ${tokenA}`);
    const cancelInProgRes = await request(app)
      .patch(`/api/bookings/${inProgressBooking.id}/cancel`)
      .set("Authorization", `Bearer ${tokenA}`);
    checklistResults["Cannot cancel a completed or in-progress booking"] =
      cancelCompRes.status === 400 && cancelInProgRes.status === 400;

    // CHECK 6: Pending payment is invalidated when booking is cancelled
    const invalidatedPayment = await prisma.payment.findUnique({
      where: { bookingId: pendingBooking.id },
    });
    checklistResults["Pending payment is invalidated when booking is cancelled"] =
      invalidatedPayment?.paymentStatus === "FAILED";

    // CHECK 7: Paid booking cancellation is rejected until refund support exists
    const cancelPaidRes = await request(app)
      .patch(`/api/bookings/${paidBooking.id}/cancel`)
      .set("Authorization", `Bearer ${tokenA}`);
    checklistResults["Paid booking cancellation is rejected until refund support exists"] =
      cancelPaidRes.status === 409;

    // Cleanup
    await prisma.payment.deleteMany({
      where: { bookingId: { in: [pendingBooking.id, paidBooking.id, completedBooking.id, inProgressBooking.id] } },
    });
    await prisma.booking.deleteMany({
      where: { id: { in: [pendingBooking.id, paidBooking.id, completedBooking.id, inProgressBooking.id] } },
    });

    console.log("\n--- FINAL VERIFICATION CHECKLIST RESULTS ---\n");
    let passedCount = 0;
    const totalCount = Object.keys(checklistResults).length;
    for (const [item, passed] of Object.entries(checklistResults)) {
      if (passed) passedCount++;
      console.log(`[${passed ? "✔" : "✘"}] ${item}`);
    }

    console.log(`\nTesting progress: ${passedCount} of ${totalCount} checks PASSED.\n`);
    if (passedCount === totalCount) {
      console.log("=== PHASE 5.5 VERIFICATION COMPLETE: ALL CHECKS PASSED ===");
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (err) {
    console.error("Checklist test error:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyChecklist();
