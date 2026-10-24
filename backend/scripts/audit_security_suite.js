import fs from "fs";
import request from "supertest";
import bcrypt from "bcryptjs";
import app from "../src/app.js";
import prisma from "../src/config/prisma.js";
import { generateAccessToken } from "../utils/jwt.js";
import upload from "../middleware/upload.middleware.js";

async function runSecurityAudit() {
  console.log("===============================================================");
  console.log("            SANITI-GO COMPREHENSIVE SECURITY AUDIT            ");
  console.log("===============================================================\n");

  const results = {
    passed: 0,
    failed: 0,
    tests: [],
  };

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      results.passed++;
      results.tests.push({ status: "PASS", message });
    } else {
      console.error(`  [FAIL] ${message}`);
      results.failed++;
      results.tests.push({ status: "FAIL", message });
    }
  }

  const timestamp = Date.now();
  const hashedPassword = await bcrypt.hash("SecPass123!@#", 10);

  // Setup test actors
  const adminUser = await prisma.user.create({
    data: {
      fullName: "Audit Admin",
      email: `audit_admin_${timestamp}@sanitigo.com`,
      password: hashedPassword,
      role: "ADMIN",
      isActive: true,
      isVerified: true,
    },
  });

  const ownerA = await prisma.user.create({
    data: {
      fullName: "Audit Owner A",
      email: `audit_owner_a_${timestamp}@sanitigo.com`,
      password: hashedPassword,
      role: "OWNER",
      isActive: true,
      isVerified: true,
    },
  });

  const ownerB = await prisma.user.create({
    data: {
      fullName: "Audit Owner B",
      email: `audit_owner_b_${timestamp}@sanitigo.com`,
      password: hashedPassword,
      role: "OWNER",
      isActive: true,
      isVerified: true,
    },
  });

  const customer = await prisma.user.create({
    data: {
      fullName: "Audit Customer",
      email: `audit_customer_${timestamp}@sanitigo.com`,
      password: hashedPassword,
      role: "USER",
      isActive: true,
      isVerified: true,
    },
  });

  const adminToken = generateAccessToken({ id: adminUser.id, email: adminUser.email, role: adminUser.role });
  const ownerAToken = generateAccessToken({ id: ownerA.id, email: ownerA.email, role: ownerA.role });
  const ownerBToken = generateAccessToken({ id: ownerB.id, email: ownerB.email, role: ownerB.role });
  const customerToken = generateAccessToken({ id: customer.id, email: customer.email, role: customer.role });

  // Create toilets for Owner A and Owner B
  const toiletA = await prisma.toilet.create({
    data: {
      ownerId: ownerA.id,
      name: "Owner A Smart Pod",
      address: "100 MG Road",
      city: "Bangalore",
      state: "Karnataka",
      country: "India",
      postalCode: "560001",
      latitude: 12.9716,
      longitude: 77.5946,
      price: 20.0,
      capacity: 1,
      isAvailable: true,
      isVerified: true,
      qrToken: `QR_AUDIT_A_${timestamp}`,
    },
  });

  const toiletB = await prisma.toilet.create({
    data: {
      ownerId: ownerB.id,
      name: "Owner B Smart Pod",
      address: "200 Brigade Road",
      city: "Bangalore",
      state: "Karnataka",
      country: "India",
      postalCode: "560025",
      latitude: 12.9720,
      longitude: 77.5950,
      price: 25.0,
      capacity: 1,
      isAvailable: true,
      isVerified: false, // unverified initially for verification tests
      qrToken: `QR_AUDIT_B_${timestamp}`,
    },
  });

  try {
    // =========================================================================
    // SECTION 1: AUTHENTICATION AND ROLE CHECKS (RBAC)
    // =========================================================================
    console.log("\n--- SECTION 1: Authentication & Role (RBAC) Enforceability ---");

    // 1.1 Unauthenticated requests to protected endpoints must return 401
    const unauthToiletOwner = await request(app).get("/api/v1/toilets/owner");
    assert(unauthToiletOwner.status === 401, "Unauthenticated GET /api/v1/toilets/owner returns 401");

    const unauthAdminUsers = await request(app).get("/api/v1/admin/users");
    assert(unauthAdminUsers.status === 401, "Unauthenticated GET /api/v1/admin/users returns 401");

    const unauthAdminStats = await request(app).get("/api/v1/admin/stats");
    assert(unauthAdminStats.status === 401, "Unauthenticated GET /api/v1/admin/stats returns 401");

    const unauthNotifications = await request(app).get("/api/notifications");
    assert(unauthNotifications.status === 401, "Unauthenticated GET /api/notifications returns 401");

    const unauthFavorites = await request(app).get("/api/v1/favorites");
    assert(unauthFavorites.status === 401, "Unauthenticated GET /api/v1/favorites returns 401");

    const unauthBookings = await request(app).get("/api/bookings");
    assert(unauthBookings.status === 401, "Unauthenticated GET /api/bookings returns 401");

    const unauthOwnerVerify = await request(app).post("/api/owner/verify-token").send({ token: "SG-999999" });
    assert(unauthOwnerVerify.status === 401, "Unauthenticated POST /api/owner/verify-token returns 401");

    const unauthSessionStart = await request(app).post("/api/owner/sessions/start").send({ bookingId: "test" });
    assert(unauthSessionStart.status === 401, "Unauthenticated POST /api/owner/sessions/start returns 401");

    // 1.2 Invalid / Expired / Forged JWT returns 401
    const forgedTokenRes = await request(app)
      .get("/api/v1/toilets/owner")
      .set("Authorization", "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature");
    assert(forgedTokenRes.status === 401, "Forged token to protected route returns 401");

    // 1.3 Role Violation: Customer accessing Admin endpoint returns 403
    const customerAdminRes = await request(app)
      .get("/api/v1/admin/users")
      .set("Authorization", `Bearer ${customerToken}`);
    assert(customerAdminRes.status === 403, "Customer accessing GET /api/v1/admin/users returns 403");

    // 1.4 Role Violation: Owner accessing Admin endpoint returns 403
    const ownerAdminRes = await request(app)
      .get("/api/v1/admin/stats")
      .set("Authorization", `Bearer ${ownerAToken}`);
    assert(ownerAdminRes.status === 403, "Owner accessing GET /api/v1/admin/stats returns 403");

    // 1.5 Role Violation: Customer accessing Owner endpoint returns 403
    const customerOwnerRes = await request(app)
      .get("/api/v1/toilets/owner")
      .set("Authorization", `Bearer ${customerToken}`);
    assert(customerOwnerRes.status === 403, "Customer accessing GET /api/v1/toilets/owner returns 403");

    // 1.6 Role Violation: Customer attempting to verify token returns 403
    const customerVerifyRes = await request(app)
      .post("/api/owner/verify-token")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ token: "SG-123456" });
    assert(customerVerifyRes.status === 403, "Customer calling POST /api/owner/verify-token returns 403");

    // 1.7 Role Violation: Owner attempting customer booking creation returns 403
    const ownerCreateBookingRes = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${ownerAToken}`)
      .send({
        toiletId: toiletA.id,
        scheduledDate: "2026-10-25",
        startTime: "10:00",
        endTime: "10:30",
        paymentMethod: "MOCK",
      });
    assert(ownerCreateBookingRes.status === 403, "Owner calling POST /api/bookings returns 403");

    // =========================================================================
    // SECTION 2: OWNER DATA ISOLATION & ACCESS CONTROL
    // =========================================================================
    console.log("\n--- SECTION 2: Owner Data Isolation & Access Scope ---");

    // 2.1 Owner A can fetch only their own toilets
    const ownerAList = await request(app)
      .get("/api/v1/toilets/owner")
      .set("Authorization", `Bearer ${ownerAToken}`);
    const ownerAToiletIds = ownerAList.body.data.map((t) => t.id);
    assert(
      ownerAToiletIds.includes(toiletA.id) && !ownerAToiletIds.includes(toiletB.id),
      "Owner A list includes Toilet A and strictly excludes Toilet B"
    );

    // 2.2 Owner B cannot update Owner A's toilet
    const ownerBUpdateRes = await request(app)
      .patch(`/api/v1/toilets/${toiletA.id}`)
      .set("Authorization", `Bearer ${ownerBToken}`)
      .send({ name: "Malicious Tampered Name" });
    assert(
      ownerBUpdateRes.status === 404,
      "Owner B cannot update Owner A's toilet (returns 404 Not Found / Unauthorized)"
    );

    // Verify toilet name was NOT modified in the database
    const freshToiletA = await prisma.toilet.findUnique({ where: { id: toiletA.id } });
    assert(freshToiletA.name === "Owner A Smart Pod", "Toilet A name remains unchanged after tamper attempt");

    // 2.3 Owner B cannot delete Owner A's toilet
    const ownerBDeleteRes = await request(app)
      .delete(`/api/v1/toilets/${toiletA.id}`)
      .set("Authorization", `Bearer ${ownerBToken}`);
    assert(ownerBDeleteRes.status === 404, "Owner B cannot delete Owner A's toilet (returns 404)");

    // 2.4 Owner B cannot update operating hours for Owner A's toilet
    const sevenDaysHours = [
      "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"
    ].map((day) => ({
      day,
      openingTime: "08:00",
      closingTime: "20:00",
      isClosed: false,
    }));

    const ownerBHoursRes = await request(app)
      .put(`/api/v1/toilets/${toiletA.id}/operating-hours`)
      .set("Authorization", `Bearer ${ownerBToken}`)
      .send({ operatingHours: sevenDaysHours });
    assert(ownerBHoursRes.status === 404, "Owner B cannot update operating hours of Owner A's toilet (returns 404)");

    // 2.5 Create a confirmed booking on Toilet A to test token verification cross-owner isolation
    const futureDate = new Date(Date.now() + 5 * 60 * 1000); // 5 mins in future (within 15 min early access window)
    const bookingTokenStr = `SG-${Math.floor(100000 + Math.random() * 900000)}`;
    const bookingA = await prisma.booking.create({
      data: {
        userId: customer.id,
        toiletId: toiletA.id,
        token: bookingTokenStr,
        status: "CONFIRMED",
        scheduledDate: new Date("2026-10-25T00:00:00.000Z"),
        startTime: futureDate,
        endTime: new Date(futureDate.getTime() + 30 * 60 * 1000),
        amount: 20.0,
      },
    });

    const paymentA = await prisma.payment.create({
      data: {
        bookingId: bookingA.id,
        amount: 20.0,
        currency: "INR",
        paymentMethod: "UPI",
        paymentStatus: "SUCCESS",
        transactionId: `TXN_AUDIT_${timestamp}`,
        paidAt: new Date(),
      },
    });

    // 2.6 Owner B attempts to verify Owner A's booking token -> must be 403 Forbidden
    const ownerBVerifyBookingA = await request(app)
      .post("/api/owner/verify-token")
      .set("Authorization", `Bearer ${ownerBToken}`)
      .send({ token: bookingTokenStr });
    assert(
      ownerBVerifyBookingA.status === 403,
      "Owner B attempting to verify Owner A's booking token returns 403 Forbidden"
    );

    // 2.7 Owner A verifying Owner A's booking token -> succeeds with 200
    const ownerAVerifyBookingA = await request(app)
      .post("/api/owner/verify-token")
      .set("Authorization", `Bearer ${ownerAToken}`)
      .send({ token: bookingTokenStr });
    assert(
      ownerAVerifyBookingA.status === 200 && ownerAVerifyBookingA.body.data.verified === true,
      "Owner A successfully verifies their own booking token (200 OK)"
    );

    // 2.8 Owner B attempts to start session for Owner A's booking -> must be 403
    const ownerBStartSession = await request(app)
      .post("/api/owner/sessions/start")
      .set("Authorization", `Bearer ${ownerBToken}`)
      .send({ token: bookingTokenStr });
    assert(
      ownerBStartSession.status === 403,
      "Owner B attempting to start session for Owner A's booking returns 403 Forbidden"
    );

    // =========================================================================
    // SECTION 3: INPUT VALIDATION, PAGINATION LIMITS, UPLOADS & RATE LIMITING
    // =========================================================================
    console.log("\n--- SECTION 3: Input Validation, Pagination, Uploads & Rate Limiting ---");

    // 3.1 Input Validation: Invalid registration payload (missing email/password) returns 400
    const badRegisterRes = await request(app).post("/api/v1/auth/register").send({
      fullName: "Incomplete User",
    });
    assert(badRegisterRes.status === 400, "Incomplete registration payload returns 400 Bad Request");

    // 3.2 Input Validation: Invalid search parameters (minPrice > maxPrice) returns 400
    const badPriceSearch = await request(app)
      .get("/api/v1/toilets/search?minPrice=50&maxPrice=10")
      .set("Authorization", `Bearer ${customerToken}`);
    assert(badPriceSearch.status === 400, "Search with minPrice > maxPrice returns 400 Bad Request");

    // 3.3 Input Validation: Invalid rating parameter (> 5) returns 400
    const badRatingSearch = await request(app)
      .get("/api/v1/toilets/search?minRating=6")
      .set("Authorization", `Bearer ${customerToken}`);
    assert(badRatingSearch.status === 400, "Search with minRating > 5 returns 400 Bad Request");

    // 3.4 Pagination Limits: Negative page returns 400
    const badPageSearch = await request(app)
      .get("/api/v1/toilets/search?page=-1")
      .set("Authorization", `Bearer ${customerToken}`);
    assert(badPageSearch.status === 400, "Search with page < 1 returns 400 Bad Request");

    // 3.5 Pagination Limits: Notification pagination enforces max limit
    const badLimitNotification = await request(app)
      .get("/api/notifications?limit=500")
      .set("Authorization", `Bearer ${customerToken}`);
    assert(badLimitNotification.status === 400, "Notification query with limit > 100 returns 400 Bad Request");

    // 3.6 Upload Restrictions: Multer configuration audit
    const multerLimits = upload?.limits || {};
    assert(multerLimits.fileSize === 5 * 1024 * 1024, "Multer restricts file uploads to max 5MB");

    // 3.7 Rate Limiting: Test rate limiter headers and enforcement
    const rateLimitTestRes = await request(app)
      .get("/api/v1/admin/stats")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-test-rate-limit", "true");
    assert(
      rateLimitTestRes.headers["x-ratelimit-limit"] !== undefined &&
      rateLimitTestRes.headers["x-ratelimit-remaining"] !== undefined,
      "API responses contain X-RateLimit headers"
    );

    // =========================================================================
    // SECTION 4: SECRETS AND REPOSITORY CONFIGURATION AUDIT
    // =========================================================================
    console.log("\n--- SECTION 4: Secrets and Git Configuration Audit ---");

    // Verify .gitignore ignores sensitive files
    const gitignore = fs.readFileSync(".gitignore", "utf-8");
    assert(gitignore.includes(".env"), ".gitignore explicitly includes .env");
    assert(gitignore.includes(".env.test"), ".gitignore explicitly includes .env.test");
    assert(gitignore.includes(".neon"), ".gitignore explicitly includes .neon");

    // Check .env.example does not have real credentials
    const envExample = fs.readFileSync(".env.example", "utf-8");
    const hasRealSecrets = envExample.includes("neon.tech") || envExample.includes("SG-PROD");
    assert(!hasRealSecrets, ".env.example contains only template placeholders and no live credentials");

    // =========================================================================
    // SECTION 5: ADMIN DEACTIVATION & TOILET VERIFICATION RULES
    // =========================================================================
    console.log("\n--- SECTION 5: Admin Deactivation & Toilet Verification Enforceability ---");

    // 5.1 Admin deactivates Customer
    const deactCustomerRes = await request(app)
      .patch(`/api/v1/admin/users/${customer.id}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: false });
    assert(deactCustomerRes.status === 200 && deactCustomerRes.body.data.user.isActive === false, "Admin deactivates customer account (200 OK)");

    // 5.2 Deactivated Customer's existing JWT token is immediately rejected with 403
    const deactivatedApiCall = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${customerToken}`);
    assert(
      deactivatedApiCall.status === 403,
      "Deactivated customer API call is rejected with 403 (Account has been deactivated)"
    );

    // 5.3 Deactivated Customer cannot log in -> returns 403
    const deactivatedLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: customer.email,
        password: "SecPass123!@#",
      });
    assert(
      deactivatedLogin.status === 403,
      "Deactivated customer login attempt is rejected with 403"
    );

    // 5.4 Reactivate customer
    const reactivateRes = await request(app)
      .patch(`/api/v1/admin/users/${customer.id}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: true });
    assert(reactivateRes.status === 200 && reactivateRes.body.data.user.isActive === true, "Admin re-activates customer account");

    // Customer API call now succeeds
    const reactivatedApiCall = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${customerToken}`);
    assert(reactivatedApiCall.status === 200, "Reactivated customer can successfully make API calls again (200 OK)");

    // 5.5 Toilet Verification: Toilet B is unverified (isVerified: false)
    // Usage session for unverified toilet is rejected with 409
    const unverifiedBooking = await prisma.booking.create({
      data: {
        userId: customer.id,
        toiletId: toiletB.id,
        token: `SG-${Math.floor(100000 + Math.random() * 900000)}`,
        status: "CONFIRMED",
        scheduledDate: new Date("2026-10-25T00:00:00.000Z"),
        startTime: futureDate,
        endTime: new Date(futureDate.getTime() + 30 * 60 * 1000),
        amount: 25.0,
      },
    });

    await prisma.payment.create({
      data: {
        bookingId: unverifiedBooking.id,
        amount: 25.0,
        currency: "INR",
        paymentMethod: "UPI",
        paymentStatus: "SUCCESS",
        transactionId: `TXN_UNVERIFIED_${timestamp}`,
        paidAt: new Date(),
      },
    });

    const unverifiedSessionStart = await request(app)
      .post("/api/owner/sessions/start")
      .set("Authorization", `Bearer ${ownerBToken}`)
      .send({ token: unverifiedBooking.token });
    assert(
      unverifiedSessionStart.status === 409,
      "Session start for unverified toilet rejected with 409 (Not available for use)"
    );

    // 5.6 Admin verifies Toilet B
    const verifyToiletBRes = await request(app)
      .patch(`/api/v1/admin/toilets/${toiletB.id}/verify`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isVerified: true });
    assert(
      verifyToiletBRes.status === 200 && verifyToiletBRes.body.data.toilet.isVerified === true,
      "Admin verifies Toilet B (200 OK, isVerified: true)"
    );

    // 5.7 Now session start for verified Toilet B succeeds
    const verifiedSessionStart = await request(app)
      .post("/api/owner/sessions/start")
      .set("Authorization", `Bearer ${ownerBToken}`)
      .send({ token: unverifiedBooking.token });
    assert(
      verifiedSessionStart.status === 201,
      "Session start for newly verified Toilet B now succeeds (201 Created)"
    );

    // 5.8 Clean up session if created
    if (verifiedSessionStart.body?.data?.session?.id) {
      await prisma.usageSession.delete({ where: { id: verifiedSessionStart.body.data.session.id } });
    }

    // Clean up test bookings and payments
    await prisma.payment.deleteMany({ where: { bookingId: { in: [bookingA.id, unverifiedBooking.id] } } });
    await prisma.booking.deleteMany({ where: { id: { in: [bookingA.id, unverifiedBooking.id] } } });

  } finally {
    // Teardown test data
    console.log("\n--- Cleaning up audit test fixtures ---");
    await prisma.toilet.deleteMany({ where: { id: { in: [toiletA.id, toiletB.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [adminUser.id, ownerA.id, ownerB.id, customer.id] } } });
    console.log("Cleanup complete.");
  }

  console.log("\n===============================================================");
  console.log(` AUDIT COMPLETE: ${results.passed} PASSED, ${results.failed} FAILED`);
  console.log("===============================================================");

  if (results.failed > 0) {
    process.exit(1);
  }
}

runSecurityAudit()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("Security audit encountered unexpected failure:", err);
    process.exit(1);
  });
