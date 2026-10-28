#!/usr/bin/env node
import crypto from "crypto";

/**
 * SanitiGo Phase 10.2: Cloud Staging Smoke Test Suite
 * Validates the live staging deployment across all layers.
 */

const BASE_URL = process.env.STAGING_API_URL || process.env.BASE_URL || "http://localhost:5000";
const WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET || "whsec_staging_hmac_secret_minimum_32_characters";

console.log("===============================================================");
console.log("       SANITI-GO PHASE 10.2: STAGING SMOKE TEST SUITE          ");
console.log(`Target Staging URL: ${BASE_URL}`);
console.log(`Execution Timestamp: ${new Date().toISOString()}`);
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
  let customerToken = null;
  let ownerToken = null;
  let createdToiletId = null;

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Service Liveness & Operational Health Check
    // -------------------------------------------------------------------------
    console.log("\n--> 1. Checking Service Liveness & Operational Health...");
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
      `Status: ${healthRes.status}, Status payload: ${healthRes.data?.status || healthRes.data?.overallStatus}`
    );

    // -------------------------------------------------------------------------
    // TEST 2: CORS Preflight & Security Headers
    // -------------------------------------------------------------------------
    console.log("\n--> 2. Verifying CORS Preflight & Credentials Policy...");
    const corsRes = await fetch(`${BASE_URL}/api/v1/toilets`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://staging.sanitigo.com",
        "Access-Control-Request-Method": "GET",
      },
    });
    assert(
      corsRes.status === 204 || corsRes.status === 200,
      "CORS Preflight Response (OPTIONS /api/v1/toilets)",
      `Status: ${corsRes.status}, Allow-Origin: ${corsRes.headers.get("access-control-allow-origin")}`
    );

    // -------------------------------------------------------------------------
    // TEST 3: User Authentication & Role Safeguards
    // -------------------------------------------------------------------------
    console.log("\n--> 3. Testing Authentication & RBAC Isolation...");
    const customerEmail = `smoke_customer_${timestamp}@staging.sanitigo.com`;
    const custRegRes = await api("/api/v1/auth/register", {
      method: "POST",
      body: {
        fullName: "Smoke Customer",
        email: customerEmail,
        password: "SmokePassword@2026",
        phoneNumber: `98${String(timestamp).slice(-8)}`,
        role: "USER",
      },
    });
    assert(
      custRegRes.status === 201 && (custRegRes.data?.data?.accessToken || custRegRes.data?.accessToken),
      "Customer Registration on Staging (POST /api/v1/auth/register)",
      `User ID: ${custRegRes.data?.data?.user?.id || custRegRes.data?.user?.id}`
    );
    customerToken = custRegRes.data?.data?.accessToken || custRegRes.data?.accessToken;

    const ownerEmail = `smoke_owner_${timestamp}@staging.sanitigo.com`;
    const ownerRegRes = await api("/api/v1/auth/register", {
      method: "POST",
      body: {
        fullName: "Smoke Owner",
        email: ownerEmail,
        password: "SmokePassword@2026",
        phoneNumber: `97${String(timestamp).slice(-8)}`,
        role: "OWNER",
      },
    });
    assert(
      ownerRegRes.status === 201 && (ownerRegRes.data?.data?.accessToken || ownerRegRes.data?.accessToken),
      "Facility Owner Registration on Staging (POST /api/v1/auth/register)",
      `Owner ID: ${ownerRegRes.data?.data?.user?.id || ownerRegRes.data?.user?.id}`
    );
    ownerToken = ownerRegRes.data?.data?.accessToken || ownerRegRes.data?.accessToken;

    // RBAC: Customer attempting admin route must be 403 Forbidden
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
    assert(
      toiletRes.status === 201 && (toiletRes.data?.data?.toilet?.id || toiletRes.data?.toilet?.id),
      "Facility Creation by Owner (POST /api/v1/toilets/create)",
      `Toilet ID: ${toiletRes.data?.data?.toilet?.id || toiletRes.data?.toilet?.id}`
    );
    createdToiletId = toiletRes.data?.data?.toilet?.id || toiletRes.data?.toilet?.id;

    // Discovery search
    const searchRes = await api(`/api/v1/toilets/search?city=New Delhi`);
    assert(
      searchRes.status === 200 && Array.isArray(searchRes.data?.data?.toilets || searchRes.data?.toilets),
      "Facility Discovery Search by City (GET /api/v1/toilets/search)",
      `Results count: ${(searchRes.data?.data?.toilets || searchRes.data?.toilets || []).length}`
    );

    // -------------------------------------------------------------------------
    // TEST 5: Booking Creation & Turnstile Pass Token
    // -------------------------------------------------------------------------
    console.log("\n--> 5. Testing Booking Flow & Access Pass Generation...");
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const scheduledDate = tomorrow.toISOString().split("T")[0];

    const bookingRes = await api("/api/v1/bookings/create", {
      method: "POST",
      token: customerToken,
      body: {
        toiletId: createdToiletId,
        scheduledDate,
        startTime: "14:00",
        endTime: "14:30",
      },
    });
    assert(
      bookingRes.status === 201 && (bookingRes.data?.data?.booking?.token || bookingRes.data?.booking?.token),
      "Booking Creation & Turnstile Token Generation (POST /api/v1/bookings/create)",
      `Token Pass: ${bookingRes.data?.data?.booking?.token || bookingRes.data?.booking?.token}`
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
            status: "captured",
          },
        },
      },
    });

    // Submitting with INVALID signature must be 400 rejected
    const badSigRes = await api("/api/v1/payments/webhook", {
      method: "POST",
      headers: {
        "x-razorpay-signature": "invalid_fake_signature_hex",
        "Content-Type": "application/json",
      },
      body: JSON.parse(fakeWebhookPayload),
    });
    assert(
      badSigRes.status === 400,
      "Payment Webhook: Invalid HMAC Signature Rejected with 400",
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
