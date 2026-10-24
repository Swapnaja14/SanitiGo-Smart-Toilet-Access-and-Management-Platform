import request from "supertest";
import app from "../src/app.js";
import prisma from "../src/config/prisma.js";
import { generateAccessToken } from "../utils/jwt.js";

async function runRemainingModulesTests() {
  console.log("==================================================================");
  console.log("   STEP 4: COMPLETE & VERIFY REMAINING BACKEND MODULES            ");
  console.log("==================================================================\n");

  let testAdmin, testOwner, testCustomer;
  let adminToken, ownerToken, customerToken;
  let testToilet;
  let createdReviewId;

  try {
    const timestamp = Date.now();

    // 1. Setup Admin, Owner, and Customer fixtures
    testAdmin = await prisma.user.create({
      data: {
        fullName: "Test Admin",
        email: `admin_${timestamp}@sanitigo.com`,
        password: "password123",
        role: "ADMIN",
        isVerified: true,
        isActive: true,
      },
    });

    testOwner = await prisma.user.create({
      data: {
        fullName: "Test Owner",
        email: `owner_${timestamp}@sanitigo.com`,
        password: "password123",
        role: "OWNER",
        isVerified: true,
        isActive: true,
      },
    });

    testCustomer = await prisma.user.create({
      data: {
        fullName: "Test Customer",
        email: `customer_${timestamp}@sanitigo.com`,
        password: "password123",
        role: "USER",
        isVerified: true,
        isActive: true,
      },
    });

    adminToken = generateAccessToken({ id: testAdmin.id, email: testAdmin.email, role: testAdmin.role });
    ownerToken = generateAccessToken({ id: testOwner.id, email: testOwner.email, role: testOwner.role });
    customerToken = generateAccessToken({ id: testCustomer.id, email: testCustomer.email, role: testCustomer.role });

    console.log(`[Setup] Admin ID: ${testAdmin.id}`);
    console.log(`[Setup] Owner ID: ${testOwner.id}`);
    console.log(`[Setup] Customer ID: ${testCustomer.id}`);

    // Create test toilet
    testToilet = await prisma.toilet.create({
      data: {
        ownerId: testOwner.id,
        name: `Remaining Modules Test Toilet ${timestamp}`,
        address: "74 Marine Drive",
        city: "Mumbai",
        state: "Maharashtra",
        country: "India",
        postalCode: "400020",
        latitude: 18.9438,
        longitude: 72.8231,
        price: 25.0,
        isAvailable: true,
        isVerified: false,
        qrToken: "QR_TEST_" + timestamp,
      },
    });
    console.log(`[Setup] Toilet ID: ${testToilet.id}\n`);

    // =========================================================================
    // MODULE 1: REVIEWS AND RATINGS
    // =========================================================================
    console.log("--- Module 1: Reviews and Ratings Workflow ---");

    // 1.1 Customer adds a review
    console.log("1.1 Customer submits review (rating: 5, comment: 'Sparkling clean!')");
    const reviewRes = await request(app)
      .post(`/api/v1/reviews/toilet/${testToilet.id}`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        rating: 5,
        comment: "Sparkling clean!",
      });

    console.log(`Submit Review Status: ${reviewRes.status}`);
    if (reviewRes.status !== 200 || !reviewRes.body.success) {
      throw new Error(`Review submission failed: ${JSON.stringify(reviewRes.body)}`);
    }
    createdReviewId = reviewRes.body.data.review.id;
    console.log(`✓ Review created with ID: ${createdReviewId}`);

    // 1.2 Verify toilet's averageRating and totalReviews updated atomically
    const updatedToilet = await prisma.toilet.findUnique({ where: { id: testToilet.id } });
    console.log(`Toilet Average Rating: ${updatedToilet.averageRating}, Total Reviews: ${updatedToilet.totalReviews}`);
    if (updatedToilet.averageRating !== 5 || updatedToilet.totalReviews !== 1) {
      throw new Error("Toilet ratings were not recomputed correctly!");
    }
    console.log("✓ Rating recomputation verified.");

    // 1.3 Get toilet reviews
    const getReviewsRes = await request(app).get(`/api/v1/reviews/toilet/${testToilet.id}`);
    console.log(`Get Toilet Reviews Status: ${getReviewsRes.status}, items returned: ${getReviewsRes.body.data.reviews.length}`);
    if (getReviewsRes.status !== 200 || getReviewsRes.body.data.reviews.length !== 1) {
      throw new Error("Failed fetching toilet reviews");
    }

    // 1.4 Get customer's own reviews
    const getMyReviewsRes = await request(app)
      .get("/api/v1/reviews/my")
      .set("Authorization", `Bearer ${customerToken}`);
    console.log(`Get Customer Reviews Status: ${getMyReviewsRes.status}, items returned: ${getMyReviewsRes.body.data.reviews.length}`);
    if (getMyReviewsRes.status !== 200 || getMyReviewsRes.body.data.reviews.length !== 1) {
      throw new Error("Failed fetching customer reviews");
    }
    console.log("✓ Module 1 Passed: Reviews and ratings fully operational.\n");

    // =========================================================================
    // MODULE 2: ADMIN FUNCTIONALITY & ROLE ENFORCEMENT
    // =========================================================================
    console.log("--- Module 2: Admin Functionality & Role Protection ---");

    // 2.1 Role Protection: Customer attempting to access admin route must be 403 Forbidden
    const unauthRes = await request(app)
      .get("/api/v1/admin/stats")
      .set("Authorization", `Bearer ${customerToken}`);
    console.log(`Customer accessing /api/v1/admin/stats Status: ${unauthRes.status} (Expected: 403)`);
    if (unauthRes.status !== 403) {
      throw new Error(`Expected 403 Forbidden for non-admin, got ${unauthRes.status}`);
    }

    // 2.2 Admin retrieves platform stats
    const statsRes = await request(app)
      .get("/api/v1/admin/stats")
      .set("Authorization", `Bearer ${adminToken}`);
    console.log(`Admin Stats Status: ${statsRes.status}`);
    console.log("Stats Overview:", JSON.stringify(statsRes.body.data.stats, null, 2));
    if (statsRes.status !== 200 || !statsRes.body.data.stats.users) {
      throw new Error("Failed fetching admin stats");
    }

    // 2.3 Admin lists users with filter
    const listUsersRes = await request(app)
      .get("/api/v1/admin/users?role=OWNER")
      .set("Authorization", `Bearer ${adminToken}`);
    console.log(`Admin List Owners Status: ${listUsersRes.status}, total found: ${listUsersRes.body.data.pagination.total}`);
    if (listUsersRes.status !== 200) {
      throw new Error("Failed listing users for admin");
    }

    // 2.4 Admin verifies a toilet
    const verifyToiletRes = await request(app)
      .patch(`/api/v1/admin/toilets/${testToilet.id}/verify`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isVerified: true });
    console.log(`Admin Verify Toilet Status: ${verifyToiletRes.status}, isVerified: ${verifyToiletRes.body.data.toilet.isVerified}`);
    if (verifyToiletRes.status !== 200 || !verifyToiletRes.body.data.toilet.isVerified) {
      throw new Error("Failed verifying toilet as admin");
    }

    // 2.5 Admin toggles user status
    const toggleUserRes = await request(app)
      .patch(`/api/v1/admin/users/${testCustomer.id}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: false });
    console.log(`Admin Deactivate User Status: ${toggleUserRes.status}, isActive: ${toggleUserRes.body.data.user.isActive}`);
    if (toggleUserRes.status !== 200 || toggleUserRes.body.data.user.isActive !== false) {
      throw new Error("Failed deactivating user as admin");
    }

    // Reactivate user
    await request(app)
      .patch(`/api/v1/admin/users/${testCustomer.id}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: true });
    console.log("✓ Module 2 Passed: Admin functionality and RBAC protection confirmed.\n");

    // =========================================================================
    // MODULE 3: SEARCH, FILTERING & NEARBY GEOSPATIAL QUERIES
    // =========================================================================
    console.log("--- Module 3: Search and Geospatial Filtering ---");

    // 3.1 Search toilets by city and verification status
    const searchRes = await request(app)
      .get(`/api/v1/toilets/search?city=Mumbai&isVerified=true`)
      .set("Authorization", `Bearer ${customerToken}`);
    console.log(`Search by city=Mumbai Status: ${searchRes.status}, count: ${searchRes.body.data.toilets.length}`);
    if (searchRes.status !== 200) {
      throw new Error("Search toilets failed");
    }

    // 3.2 Nearby geospatial search within 10km radius
    const nearbyRes = await request(app)
      .get(`/api/v1/toilets/nearby?latitude=18.9430&longitude=72.8230&radius=10`)
      .set("Authorization", `Bearer ${customerToken}`);
    console.log(`Nearby Search Status: ${nearbyRes.status}, toilets in radius: ${nearbyRes.body.data?.toilets?.length}`);
    if (nearbyRes.status !== 200 || !Array.isArray(nearbyRes.body.data?.toilets)) {
      throw new Error("Nearby search failed");
    }
    console.log("✓ Module 3 Passed: Search and geospatial queries verified.\n");

    // =========================================================================
    // MODULE 4: PRODUCTION READINESS & OPERATIONAL HEALTH
    // =========================================================================
    console.log("--- Module 4: Production-Readiness & Health Endpoint ---");
    // Clean up old simulated test event left over from Phase 5.11 testing
    await prisma.outboxEvent.deleteMany({
      where: { eventType: "test.failure.simulation" }
    });

    const healthRes = await request(app).get("/api/health/operations");
    console.log(`Operational Health Status: ${healthRes.status}`);
    console.log("Health Payload:", JSON.stringify(healthRes.body, null, 2));
    if (!healthRes.body.status) {
      throw new Error("Operational health check failed");
    }
    console.log("✓ Module 4 Passed: Operational health check verified.\n");

    console.log("==================================================================");
    console.log("   ALL REMAINING BACKEND MODULES VERIFIED SUCCESSFULLY!           ");
    console.log("==================================================================");
  } catch (error) {
    console.error("Test execution failed:", error);
    process.exit(1);
  } finally {
    // Cleanup
    if (testToilet) {
      await prisma.review.deleteMany({ where: { toiletId: testToilet.id } });
      await prisma.toilet.delete({ where: { id: testToilet.id } }).catch(() => {});
    }
    if (testCustomer) {
      await prisma.user.delete({ where: { id: testCustomer.id } }).catch(() => {});
    }
    if (testOwner) {
      await prisma.user.delete({ where: { id: testOwner.id } }).catch(() => {});
    }
    if (testAdmin) {
      await prisma.user.delete({ where: { id: testAdmin.id } }).catch(() => {});
    }
    await prisma.$disconnect();
  }
}

runRemainingModulesTests();
