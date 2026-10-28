#!/usr/bin/env node
import crypto from "crypto";

/**
 * SanitiGo Phase 10.2: Cloud Staging Smoke Test Suite
 * Validates the live staging deployment across all layers.
 * 
 * Environment variables:
 * - STAGING_BASE_URL / STAGING_API_URL: Deployed backend URL (e.g. https://sanitigo-backend-staging.onrender.com)
 * - FRONTEND_ORIGIN: Deployed frontend origin (e.g. https://sanitigo-frontend-staging.onrender.com)
 * - PAYMENT_WEBHOOK_SECRET: Staging payment webhook secret
 * - DATABASE_URL: Optional direct staging database connection for post-test cleanup
 */

const BASE_URL = process.env.STAGING_BASE_URL || process.env.STAGING_API_URL || process.env.BASE_URL || "http://localhost:5000";
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "https://sanitigo-frontend-staging.onrender.com";
const WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET || "whsec_staging_hmac_secret_minimum_32_characters";

console.log("===============================================================");
console.log("       SANITI-GO PHASE 10.2: STAGING SMOKE TEST SUITE          ");
console.log(`Target Staging Backend: ${BASE_URL}`);
console.log(`Target Frontend Origin: ${FRONTEND_ORIGIN}`);
console.log(`Execution Timestamp:    ${new Date().toISOString()}`);
console.log("===============================================================\n");

let passedCount = 0;
let failedCount = 0;

function assert(condition, testName, details = "") {
  if (condition) {
    passedCount++;
    console.log(`✔ [PASS] ${testName}`);
    if (details) console.log(`   Evidence: ${details}`);
  } else {
    failedCount++;
    console.error(`❌ [FAIL] ${testName}`);
    if (details) console.error(`   Failure Details: ${details}`);
  }
}

async function api(path, { method = "GET", body, token, headers = {} } = {}) {
  const reqHeaders = { "Content-Type": "application/json", ...headers };
  if (token) {
    reqHeaders["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: reqHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  const contentType = res.headers.get("content-type") || "";
  let data = null;
  if (contentType.includes("application/json")) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  return { status: res.status, ok: res.ok, headers: res.headers, data };
}

async function runStagingSmokeTests() {
  const timestamp = Date.now();
  let customerId = null;
  let ownerId = null;
  let customerToken = null;
  let ownerToken = null;
  let createdToiletId = null;
  let createdBookingId = null;

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Service Liveness & Operational Health Check
    // -------------------------------------------------------------------------
    console.log("--> 1. Checking Service Liveness & Operational Health...");
    const rootRes = await api("/");
    assert(
      rootRes.status === 200 && rootRes.data?.success === true,
      "Base HTTP Endpoint Liveness (GET /)",
      `Status: ${rootRes.status}, Message: ${rootRes.data?.message}`
    );

    const healthRes = await api("/api/health/operations");
    assert(
      healthRes.status === 200 || healthRes.status === 503,
      "Operational Diagnostics Endpoint (GET /api/health/operations)",
      `Status: ${healthRes.status}, Status payload: ${healthRes.data?.status || healthRes.data?.overallStatus || "OK"}`
    );

    // -------------------------------------------------------------------------
    // TEST 2: CORS Preflight & Security Headers
    // -------------------------------------------------------------------------
    console.log("\n--> 2. Verifying CORS Preflight & Credentials Policy from Frontend Origin...");
    const corsRes = await fetch(`${BASE_URL}/api/v1/toilets`, {
      method: "OPTIONS",
      headers: {
        Origin: FRONTEND_ORIGIN,
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "Content-Type,Authorization",
      },
    });
    const allowOrigin = corsRes.headers.get("access-control-allow-origin");
    assert(
      (corsRes.status === 204 || corsRes.status === 200) && (allowOrigin === FRONTEND_ORIGIN || allowOrigin === "*"),
      "CORS Preflight Response (OPTIONS /api/v1/toilets)",
      `Status: ${corsRes.status}, Allow-Origin: ${allowOrigin}, Origin Tested: ${FRONTEND_ORIGIN}`
    );

    // -------------------------------------------------------------------------
    // TEST 3: User & Owner Registration and Login (RBAC Isolation)
    // -------------------------------------------------------------------------
    console.log("\n--> 3. Testing Authentication (Register & Login) and RBAC Protection...");
    
    // 3a. Customer Registration
    const customerEmail = `smoke_customer_${timestamp}@staging.sanitigo.com`;
    const customerPassword = "SmokePassword@2026";
    const custRegRes = await api("/api/v1/auth/register", {
      method: "POST",
      body: {
        fullName: "Smoke Customer",
        email: customerEmail,
        password: customerPassword,
        phoneNumber: `98${String(timestamp).slice(-8)}`,
        role: "USER",
      },
    });
    customerId = custRegRes.data?.data?.user?.id || custRegRes.data?.user?.id;
    customerToken = custRegRes.data?.data?.accessToken || custRegRes.data?.accessToken;
    assert(
      custRegRes.status === 201 && customerToken,
      "Customer Registration on Staging (POST /api/v1/auth/register)",
      `User ID: ${customerId}`
    );

    // 3b. Customer Login
    const custLoginRes = await api("/api/v1/auth/login", {
      method: "POST",
      body: {
        email: customerEmail,
        password: customerPassword,
      },
    });
    const loginAccessToken = custLoginRes.data?.data?.accessToken || custLoginRes.data?.accessToken;
    assert(
      custLoginRes.status === 200 && Boolean(loginAccessToken),
      "Customer Login Verification (POST /api/v1/auth/login)",
      `Status: ${custLoginRes.status}, Token received: ${Boolean(loginAccessToken)}`
    );
    if (loginAccessToken) customerToken = loginAccessToken;

    // 3c. Owner Registration & Login
    const ownerEmail = `smoke_owner_${timestamp}@staging.sanitigo.com`;
    const ownerPassword = "SmokePassword@2026";
    const ownerRegRes = await api("/api/v1/auth/register", {
      method: "POST",
      body: {
        fullName: "Smoke Owner",
        email: ownerEmail,
        password: ownerPassword,
        phoneNumber: `97${String(timestamp).slice(-8)}`,
        role: "OWNER",
      },
    });
    ownerId = ownerRegRes.data?.data?.user?.id || ownerRegRes.data?.user?.id;
    ownerToken = ownerRegRes.data?.data?.accessToken || ownerRegRes.data?.accessToken;
    assert(
      ownerRegRes.status === 201 && ownerToken,
      "Facility Owner Registration on Staging (POST /api/v1/auth/register)",
      `Owner ID: ${ownerId}`
    );

    const ownerLoginRes = await api("/api/v1/auth/login", {
      method: "POST",
      body: {
        email: ownerEmail,
        password: ownerPassword,
      },
    });
    const ownerLoginToken = ownerLoginRes.data?.data?.accessToken || ownerLoginRes.data?.accessToken;
    assert(
      ownerLoginRes.status === 200 && Boolean(ownerLoginToken),
      "Facility Owner Login Verification (POST /api/v1/auth/login)",
      `Status: ${ownerLoginRes.status}`
    );
    if (ownerLoginToken) ownerToken = ownerLoginToken;

    // 3d. RBAC: Non-admin customer blocked from admin console
    const forbiddenRes = await api("/api/v1/admin/stats", {
      token: customerToken,
    });
    assert(
      forbiddenRes.status === 403,
      "RBAC Protection: Customer blocked from admin route (GET /api/v1/admin/stats)",
      `Status: ${forbiddenRes.status} (Expected: 403 Forbidden)`
    );

    // -------------------------------------------------------------------------
    // TEST 4: Facility Creation & Discovery
    // -------------------------------------------------------------------------
    console.log("\n--> 4. Testing Facility Provisioning & Discovery...");
    const toiletRes = await api("/api/v1/toilets/create", {
      method: "POST",
      token: ownerToken,
      body: {
        name: `Staging Smoke Pod ${timestamp}`,
        address: "42 Connaught Place",
        city: "New Delhi",
        state: "Delhi",
        country: "India",
        postalCode: "110001",
        latitude: 28.6315,
        longitude: 77.2167,
        price: 20.0,
      },
    });
    createdToiletId = toiletRes.data?.data?.id || toiletRes.data?.data?.toilet?.id || toiletRes.data?.toilet?.id;
    assert(
      toiletRes.status === 201 && createdToiletId,
      "Facility Creation by Owner (POST /api/v1/toilets/create)",
      `Toilet ID: ${createdToiletId}`
    );

    // Configure 7-day operating hours so bookings can be scheduled
    const daysOfWeek = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
    await api(`/api/v1/toilets/${createdToiletId}/operating-hours`, {
      method: "PUT",
      token: ownerToken,
      body: {
        operatingHours: daysOfWeek.map((day) => ({
          day,
          openingTime: "06:00",
          closingTime: "23:00",
          isClosed: false,
        })),
      },
    });

    // Discovery search
    const searchRes = await api(`/api/v1/toilets/search?city=New Delhi`, {
      token: customerToken,
    });
    const toiletsList = searchRes.data?.data?.toilets || searchRes.data?.toilets || [];
    assert(
      searchRes.status === 200 && Array.isArray(toiletsList),
      "Facility Discovery Search by City (GET /api/v1/toilets/search)",
      `Results count: ${toiletsList.length}`
    );

    // -------------------------------------------------------------------------
    // TEST 5: Booking Creation & Turnstile Pass Token
    // -------------------------------------------------------------------------
    console.log("\n--> 5. Testing Booking Flow & Access Pass Generation...");
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const scheduledDate = tomorrow.toISOString().split("T")[0];

    const bookingRes = await api("/api/v1/bookings", {
      method: "POST",
      token: customerToken,
      body: {
        toiletId: createdToiletId,
        scheduledDate,
        startTime: "14:00",
        endTime: "14:30",
        paymentMethod: "UPI",
      },
    });
    const passToken = bookingRes.data?.data?.token || bookingRes.data?.data?.booking?.token;
    createdBookingId = bookingRes.data?.data?.id || bookingRes.data?.data?.booking?.id;
    assert(
      bookingRes.status === 201 && Boolean(passToken),
      "Booking Creation & Turnstile Token Generation (POST /api/v1/bookings)",
      `Turnstile Token Pass: ${passToken}`
    );

    // -------------------------------------------------------------------------
    // TEST 6: Payment Webhook HMAC Signature Security
    // -------------------------------------------------------------------------
    console.log("\n--> 6. Testing Payment Webhook HMAC Verification...");
    const fakeWebhookPayload = JSON.stringify({
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: `pay_smoke_${timestamp}`,
            amount: 2000,
            currency: "INR",
            status: "captured",
            notes: {
              bookingId: createdBookingId || "dummy_booking_id",
            },
          },
        },
      },
    });

    // Submitting with INVALID signature must be rejected (401 or 400)
    const badSigRes = await api("/api/v1/payments/webhook", {
      method: "POST",
      headers: {
        "x-razorpay-signature": "invalid_fake_signature_hex",
        "Content-Type": "application/json",
      },
      body: JSON.parse(fakeWebhookPayload),
    });
    assert(
      badSigRes.status === 401 || badSigRes.status === 400,
      "Payment Webhook: Invalid HMAC Signature Rejected with 401/400",
      `Status: ${badSigRes.status}`
    );

    // Submitting with VALID HMAC signature
    const validSignature = crypto
      .createHmac("sha256", WEBHOOK_SECRET)
      .update(fakeWebhookPayload)
      .digest("hex");

    const validSigRes = await api("/api/v1/payments/webhook", {
      method: "POST",
      headers: {
        "x-razorpay-signature": validSignature,
        "Content-Type": "application/json",
      },
      body: JSON.parse(fakeWebhookPayload),
    });
    assert(
      validSigRes.status === 200 || validSigRes.status === 202,
      "Payment Webhook: Valid HMAC Signature Processed",
      `Status: ${validSigRes.status}`
    );

  } catch (error) {
    console.error("Unexpected error during staging smoke tests:", error);
    failedCount++;
  } finally {
    // -------------------------------------------------------------------------
    // CLEANUP: Clean up test records created by this smoke test script
    // -------------------------------------------------------------------------
    console.log("\n--> [Cleanup] Removing smoke test fixtures from staging...");
    
    // Direct database cleanup in reverse foreign-key order
    if (process.env.DATABASE_URL) {
      try {
        const { PrismaClient } = await import("@prisma/client");
        const prisma = new PrismaClient({
          datasources: { db: { url: process.env.DATABASE_URL } },
        });

        if (createdBookingId) {
          await prisma.payment.deleteMany({ where: { bookingId: createdBookingId } });
          await prisma.outboxEvent.deleteMany({ where: { aggregateId: createdBookingId } });
          await prisma.booking.deleteMany({ where: { id: createdBookingId } });
        }
        if (createdToiletId) {
          await prisma.toilet.deleteMany({ where: { id: createdToiletId } });
        }
        if (customerId) {
          await prisma.user.deleteMany({ where: { id: customerId } });
        }
        if (ownerId) {
          await prisma.user.deleteMany({ where: { id: ownerId } });
        }
        await prisma.$disconnect();
        console.log("  ✔ Smoke test users & bookings cleaned up from database.");
      } catch (err) {
        console.warn(`  ⚠ Database cleanup notice: ${err.message}`);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log("\n===============================================================");
  console.log("            STAGING SMOKE TEST SUITE SUMMARY                   ");
  console.log(`Passed Tests: ${passedCount}`);
  console.log(`Failed Tests: ${failedCount}`);
  console.log("===============================================================\n");

  if (failedCount > 0) {
    console.error("❌ Staging smoke tests failed! Inspect logs before promoting to production.");
    process.exit(1);
  } else {
    console.log("✔ ALL STAGING SMOKE TESTS PASSED! Staging environment is verified healthy.");
    process.exit(0);
  }
}

runStagingSmokeTests();
