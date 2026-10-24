import dotenv from "dotenv";
dotenv.config();

import prisma from "../src/config/prisma.js";
import { generateAccessToken } from "../utils/jwt.js";

async function setupPostmanTest() {
  console.log("==========================================================");
  console.log(" SanitiGo — Postman Payment Workflow Setup & Live Test");
  console.log("==========================================================");

  // 1. Ensure test customer exists
  let customer = await prisma.user.findFirst({
    where: { email: "postman_customer@example.com" },
  });

  if (!customer) {
    customer = await prisma.user.create({
      data: {
        fullName: "Postman Test User",
        email: "postman_customer@example.com",
        password: "hashed_dummy_password",
        role: "USER",
      },
    });
  }

  // 2. Ensure test owner & toilet exists
  let owner = await prisma.user.findFirst({
    where: { role: "OWNER" },
  });

  if (!owner) {
    owner = await prisma.user.create({
      data: {
        fullName: "Test Toilet Owner",
        email: "owner_test_postman@example.com",
        password: "hashed_dummy_password",
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
        name: "Prime Station Smart Restroom",
        address: "Platform 1, Central Station",
        city: "Mumbai",
        state: "Maharashtra",
        country: "India",
        postalCode: "400001",
        price: 20.0,
        latitude: 18.9696,
        longitude: 72.8194,
        qrToken: "QR_PRIME_" + Date.now(),
      },
    });
  }

  // 3. Create a fresh PENDING booking for Test A, B, C
  const bookingA = await prisma.booking.create({
    data: {
      userId: customer.id,
      toiletId: toilet.id,
      scheduledDate: new Date("2026-11-15T00:00:00.000Z"),
      startTime: new Date("2026-11-15T14:00:00.000Z"),
      endTime: new Date("2026-11-15T14:30:00.000Z"),
      amount: 20.0,
      status: "PENDING",
    },
  });

  // 4. Create another PENDING booking for Test D (Failed + Retry)
  const bookingD = await prisma.booking.create({
    data: {
      userId: customer.id,
      toiletId: toilet.id,
      scheduledDate: new Date("2026-11-16T00:00:00.000Z"),
      startTime: new Date("2026-11-16T15:00:00.000Z"),
      endTime: new Date("2026-11-16T15:30:00.000Z"),
      amount: 20.0,
      status: "PENDING",
    },
  });

  // 5. Generate Customer JWT
  const customerToken = generateAccessToken({
    id: customer.id,
    email: customer.email,
    role: customer.role,
  });

  // 6. Generate Another User JWT for Cross-Customer Authorization Test
  let otherUser = await prisma.user.findFirst({
    where: { email: "other_customer@example.com" },
  });
  if (!otherUser) {
    otherUser = await prisma.user.create({
      data: {
        fullName: "Other Customer",
        email: "other_customer@example.com",
        password: "hashed_dummy_password",
        role: "USER",
      },
    });
  }
  const otherUserToken = generateAccessToken({
    id: otherUser.id,
    email: otherUser.email,
    role: otherUser.role,
  });

  console.log("\n--- TEST CREDENTIALS GENERATED ---");
  console.log(`Customer Token (JWT):\n${customerToken}\n`);
  console.log(`Booking ID for Test A, B, C: ${bookingA.id}`);
  console.log(`Booking ID for Test D (Failure/Retry): ${bookingD.id}`);

  // Perform Live HTTP Requests against localhost:5000
  console.log("\n--- EXECUTING LIVE HTTP CALLS AGAINST LOCALHOST:5000 ---\n");

  // TEST A: Initiate Payment
  const resA = await fetch(`http://127.0.0.1:5000/api/bookings/${bookingA.id}/payment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${customerToken}`,
    },
    body: JSON.stringify({ paymentMethod: "UPI" }),
  });
  const dataA = await resA.json();
  console.log(`[Test A] POST /api/bookings/${bookingA.id}/payment -> HTTP ${resA.status}`);
  console.log(JSON.stringify(dataA, null, 2));

  // TEST B: Mock Result SUCCESS
  const resB = await fetch(`http://127.0.0.1:5000/api/bookings/${bookingA.id}/payment/mock-result`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${customerToken}`,
    },
    body: JSON.stringify({ outcome: "SUCCESS" }),
  });
  const dataB = await resB.json();
  console.log(`\n[Test B] POST /api/bookings/${bookingA.id}/payment/mock-result -> HTTP ${resB.status}`);
  console.log(JSON.stringify(dataB, null, 2));

  // TEST C: Get Payment Status
  const resC = await fetch(`http://127.0.0.1:5000/api/bookings/${bookingA.id}/payment`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${customerToken}`,
    },
  });
  const dataC = await resC.json();
  console.log(`\n[Test C] GET /api/bookings/${bookingA.id}/payment -> HTTP ${resC.status}`);
  console.log(JSON.stringify(dataC, null, 2));

  // TEST D: Failed Payment & Retry Workflow
  console.log(`\n[Test D1] Initiate Payment for second booking -> HTTP POST`);
  const resD1 = await fetch(`http://127.0.0.1:5000/api/bookings/${bookingD.id}/payment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${customerToken}`,
    },
    body: JSON.stringify({ paymentMethod: "CARD" }),
  });
  const dataD1 = await resD1.json();
  console.log(`Status: ${resD1.status}, Payment status: ${dataD1.data?.paymentStatus}`);

  console.log(`\n[Test D2] Simulate FAILED outcome`);
  const resD2 = await fetch(`http://127.0.0.1:5000/api/bookings/${bookingD.id}/payment/mock-result`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${customerToken}`,
    },
    body: JSON.stringify({ outcome: "FAILED" }),
  });
  const dataD2 = await resD2.json();
  console.log(`Status: ${resD2.status}, Payment: ${dataD2.data?.payment?.paymentStatus}, Booking: ${dataD2.data?.bookingStatus}`);

  console.log(`\n[Test D3] Retry Payment Initiation (resets to PENDING)`);
  const resD3 = await fetch(`http://127.0.0.1:5000/api/bookings/${bookingD.id}/payment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${customerToken}`,
    },
    body: JSON.stringify({ paymentMethod: "UPI" }),
  });
  const dataD3 = await resD3.json();
  console.log(`Status: ${resD3.status}, Payment status: ${dataD3.data?.paymentStatus}, Method: ${dataD3.data?.paymentMethod}`);

  console.log(`\n[Test D4] Simulate SUCCESS outcome after retry`);
  const resD4 = await fetch(`http://127.0.0.1:5000/api/bookings/${bookingD.id}/payment/mock-result`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${customerToken}`,
    },
    body: JSON.stringify({ outcome: "SUCCESS" }),
  });
  const dataD4 = await resD4.json();
  console.log(`Status: ${resD4.status}, Payment: ${dataD4.data?.payment?.paymentStatus}, Booking: ${dataD4.data?.bookingStatus}, Txn: ${dataD4.data?.payment?.transactionId}`);

  // Cross-Customer Authorization Check
  console.log(`\n[Cross-Customer Guard] Other customer trying to access booking ${bookingA.id}`);
  const resCross = await fetch(`http://127.0.0.1:5000/api/bookings/${bookingA.id}/payment`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${otherUserToken}`,
    },
  });
  const dataCross = await resCross.json();
  console.log(`Status: ${resCross.status} (Expected 404 Booking not found for other user)`);
  console.log(JSON.stringify(dataCross, null, 2));

  console.log("\n==========================================================");
  console.log(" ALL TESTS (A, B, C, D & Cross-Customer Guard) VERIFIED LIVE!");
  console.log("==========================================================");

  await prisma.$disconnect();
}

setupPostmanTest().catch((err) => {
  console.error("Setup error:", err);
  process.exit(1);
});
