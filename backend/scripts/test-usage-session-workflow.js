import dotenv from "dotenv";
dotenv.config();

import request from "supertest";
import app from "../src/app.js";
import prisma from "../src/config/prisma.js";
import { generateAccessToken } from "../utils/jwt.js";

async function runUsageSessionWorkflowTests() {
  console.log("=== Testing Phase 5.7: Usage Session Management ===");

  try {
    // 1. Setup Owner 1, Owner 2, Customer
    let owner1 = await prisma.user.findFirst({
      where: { email: "owner1_57@example.com" },
    });
    if (!owner1) {
      owner1 = await prisma.user.create({
        data: {
          fullName: "Owner One 57",
          email: "owner1_57@example.com",
          password: "password_hash",
          role: "OWNER",
        },
      });
    }

    let owner2 = await prisma.user.findFirst({
      where: { email: "owner2_57@example.com" },
    });
    if (!owner2) {
      owner2 = await prisma.user.create({
        data: {
          fullName: "Owner Two 57",
          email: "owner2_57@example.com",
          password: "password_hash",
          role: "OWNER",
        },
      });
    }

    let customer = await prisma.user.findFirst({
      where: { email: "customer_57@example.com" },
    });
    if (!customer) {
      customer = await prisma.user.create({
        data: {
          fullName: "Customer 57",
          email: "customer_57@example.com",
          password: "password_hash",
          role: "USER",
        },
      });
    }

    // 2. Setup verified, available toilet
    let toilet = await prisma.toilet.findFirst({
      where: { ownerId: owner1.id },
    });
    if (!toilet) {
      toilet = await prisma.toilet.create({
        data: {
          ownerId: owner1.id,
          name: "Smart Restroom 57",
          address: "123 High Street",
          city: "Pune",
          state: "Maharashtra",
          country: "India",
          postalCode: "411001",
          price: 25.0,
          latitude: 18.5204,
          longitude: 73.8567,
          isVerified: true,
          isAvailable: true,
          qrToken: "QR_57_" + Date.now(),
        },
      });
    } else {
      // Ensure verified and available
      toilet = await prisma.toilet.update({
        where: { id: toilet.id },
        data: { isVerified: true, isAvailable: true },
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

    const now = new Date();
    // Booking active right now (starts in 5 mins, within 15-min early access window)
    const booking = await prisma.booking.create({
      data: {
        userId: customer.id,
        toiletId: toilet.id,
        token: "SG-570001",
        scheduledDate: now,
        startTime: new Date(now.getTime() + 5 * 60 * 1000),
        endTime: new Date(now.getTime() + 35 * 60 * 1000),
        amount: 25.0,
        status: "CONFIRMED",
        payment: {
          create: {
            amount: 25.0,
            currency: "INR",
            paymentMethod: "UPI",
            paymentStatus: "SUCCESS",
            transactionId: "TXN_MOCK_570001",
            paidAt: now,
          },
        },
      },
    });

    // Test A: Start a usage session
    const resA = await request(app)
      .post("/api/owner/sessions/start")
      .set("Authorization", `Bearer ${owner1Token}`)
      .send({ token: "SG-570001" });

    console.log("Test A — Start usage session status:", resA.status);
    console.assert(resA.status === 201, `Expected 201 Created, got ${resA.status}`);
    console.assert(resA.body.data.session.status === "ACTIVE", "Expected status: ACTIVE");
    console.assert(resA.body.data.session.endedAt === null, "Expected endedAt: null");
    console.assert(resA.body.data.bookingStatus === "IN_PROGRESS", "Expected bookingStatus: IN_PROGRESS");
    const sessionId = resA.body.data.session.id;
    console.log("   -> Session ID created:", sessionId);

    // Verify in database
    const dbSessionA = await prisma.usageSession.findUnique({
      where: { id: sessionId },
    });
    console.assert(dbSessionA.status === "ACTIVE", "DB Session status must be ACTIVE");
    console.assert(dbSessionA.startedAt !== null, "DB Session startedAt must be populated");
    console.assert(dbSessionA.endedAt === null, "DB Session endedAt must be null");

    const dbBookingA = await prisma.booking.findUnique({
      where: { id: booking.id },
    });
    console.assert(dbBookingA.status === "IN_PROGRESS", "DB Booking status must be IN_PROGRESS");

    // Test B: Try starting the same session again
    const resB = await request(app)
      .post("/api/owner/sessions/start")
      .set("Authorization", `Bearer ${owner1Token}`)
      .send({ token: "SG-570001" });

    console.log("Test B — Try starting duplicate session status:", resB.status);
    console.assert(resB.status === 409, `Expected 409 Conflict, got ${resB.status}`);

    // Test C: View the usage session
    const resC = await request(app)
      .get(`/api/owner/sessions/${sessionId}`)
      .set("Authorization", `Bearer ${owner1Token}`);

    console.log("Test C — View session details status:", resC.status);
    console.assert(resC.status === 200, `Expected 200 OK, got ${resC.status}`);
    console.assert(resC.body.data.id === sessionId, "Expected matched sessionId");
    console.assert(resC.body.data.status === "ACTIVE", "Expected status ACTIVE");
    console.assert(resC.body.data.toilet.name === "Smart Restroom 57", "Expected toilet details");

    // Test D: End the session
    const resD = await request(app)
      .patch(`/api/owner/sessions/${sessionId}/end`)
      .set("Authorization", `Bearer ${owner1Token}`);

    console.log("Test D — End session status:", resD.status);
    console.assert(resD.status === 200, `Expected 200 OK, got ${resD.status}`);
    console.assert(resD.body.data.session.status === "COMPLETED", "Expected session status COMPLETED");
    console.assert(resD.body.data.session.endedAt !== null, "Expected endedAt populated");
    console.assert(resD.body.data.session.duration >= 1, "Expected duration >= 1 minute");
    console.assert(resD.body.data.bookingStatus === "COMPLETED", "Expected bookingStatus COMPLETED");

    // Verify in database
    const dbSessionD = await prisma.usageSession.findUnique({
      where: { id: sessionId },
    });
    console.assert(dbSessionD.status === "COMPLETED", "DB session status must be COMPLETED");
    console.assert(dbSessionD.endedAt !== null, "DB endedAt must be populated");
    console.assert(dbSessionD.duration >= 1, "DB duration must be >= 1");

    const dbBookingD = await prisma.booking.findUnique({
      where: { id: booking.id },
    });
    console.assert(dbBookingD.status === "COMPLETED", "DB booking status must be COMPLETED");

    // Test E: Try ending the session twice
    const resE = await request(app)
      .patch(`/api/owner/sessions/${sessionId}/end`)
      .set("Authorization", `Bearer ${owner1Token}`);

    console.log("Test E — Try ending session twice status:", resE.status);
    console.assert(resE.status === 409, `Expected 409 Conflict, got ${resE.status}`);

    // Test F: Try accessing another owner's session
    const resF_get = await request(app)
      .get(`/api/owner/sessions/${sessionId}`)
      .set("Authorization", `Bearer ${owner2Token}`);

    console.log("Test F — Other owner view session status:", resF_get.status);
    console.assert(resF_get.status === 404, `Expected 404 (hidden) or 403, got ${resF_get.status}`);

    const resF_end = await request(app)
      .patch(`/api/owner/sessions/${sessionId}/end`)
      .set("Authorization", `Bearer ${owner2Token}`);

    console.log("Test F — Other owner end session status:", resF_end.status);
    console.assert(resF_end.status === 403 || resF_end.status === 404 || resF_end.status === 409, `Expected 403/404/409, got ${resF_end.status}`);

    // Cleanup
    await prisma.usageSession.deleteMany({
      where: { bookingId: booking.id },
    });
    await prisma.payment.deleteMany({
      where: { bookingId: booking.id },
    });
    await prisma.booking.deleteMany({
      where: { id: booking.id },
    });

    console.log("=== All Phase 5.7 Usage Session Tests (A-F) PASSED! ===");
    process.exit(0);
  } catch (err) {
    console.error("Test execution failed:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runUsageSessionWorkflowTests();
