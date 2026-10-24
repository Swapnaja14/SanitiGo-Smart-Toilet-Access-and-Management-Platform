import dotenv from "dotenv";
dotenv.config();

import { describe, it, expect, beforeAll, afterAll, jest } from "@jest/globals";
import request from "supertest";
import app from "../src/app.js";
import prisma from "../src/config/prisma.js";
import { generateAccessToken } from "../utils/jwt.js";

describe("Phase 7: Reviews and Ratings Verification (Steps 7.1 & 7.2)", () => {
  let customerUser;
  let customerToken;
  let otherCustomerUser;
  let otherCustomerToken;
  let ownerUser;
  let ownerToken;
  let verifiedToilet;
  let unverifiedToilet;

  beforeAll(async () => {
    const timestamp = Date.now();

    // 1. Create owner
    ownerUser = await prisma.user.create({
      data: {
        fullName: "Owner Review Test",
        email: `owner_rev_${timestamp}@example.com`,
        password: "hashedPassword123",
        role: "OWNER",
        isVerified: true,
        isActive: true,
      },
    });
    ownerToken = generateAccessToken({
      id: ownerUser.id,
      email: ownerUser.email,
      role: ownerUser.role,
    });

    // 2. Create customer 1
    customerUser = await prisma.user.create({
      data: {
        fullName: "Customer Review Test",
        email: `cust_rev_${timestamp}@example.com`,
        password: "hashedPassword123",
        role: "USER",
        isVerified: true,
        isActive: true,
      },
    });
    customerToken = generateAccessToken({
      id: customerUser.id,
      email: customerUser.email,
      role: customerUser.role,
    });

    // 3. Create customer 2 (for concurrent & independent testing)
    otherCustomerUser = await prisma.user.create({
      data: {
        fullName: "Other Customer Review Test",
        email: `other_rev_${timestamp}@example.com`,
        password: "hashedPassword123",
        role: "USER",
        isVerified: true,
        isActive: true,
      },
    });
    otherCustomerToken = generateAccessToken({
      id: otherCustomerUser.id,
      email: otherCustomerUser.email,
      role: otherCustomerUser.role,
    });

    // 4. Create verified toilet
    verifiedToilet = await prisma.toilet.create({
      data: {
        ownerId: ownerUser.id,
        name: "Verified Deluxe Restroom",
        address: "500 Indiranagar 100ft Rd",
        city: "Bengaluru",
        state: "Karnataka",
        country: "India",
        postalCode: "560038",
        price: 30.0,
        latitude: 12.9716,
        longitude: 77.5946,
        qrToken: "QR_REV_VERIFIED_" + timestamp,
        isAvailable: true,
        isVerified: true,
      },
    });

    // 5. Create unverified toilet
    unverifiedToilet = await prisma.toilet.create({
      data: {
        ownerId: ownerUser.id,
        name: "Unverified Restroom",
        address: "501 Indiranagar",
        city: "Bengaluru",
        state: "Karnataka",
        country: "India",
        postalCode: "560038",
        price: 20.0,
        latitude: 12.972,
        longitude: 77.595,
        qrToken: "QR_REV_UNVERIFIED_" + timestamp,
        isAvailable: true,
        isVerified: false,
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // Helper to create booking with payment and completed session
  async function createCompletedBookingAndSession(user, toilet) {
    const now = new Date();
    const booking = await prisma.booking.create({
      data: {
        userId: user.id,
        toiletId: toilet.id,
        amount: 30.0,
        scheduledDate: now,
        startTime: new Date(now.getTime() - 30 * 60 * 1000),
        endTime: new Date(now.getTime() + 30 * 60 * 1000),
        token: "SG-" + Math.floor(100000 + Math.random() * 900000),
        status: "COMPLETED",
        payment: {
          create: {
            amount: 30.0,
            currency: "INR",
            paymentMethod: "UPI",
            paymentStatus: "SUCCESS",
            transactionId: "txn_rev_test_" + Math.random().toString(36).substring(7),
          },
        },
      },
    });

    const session = await prisma.usageSession.create({
      data: {
        userId: user.id,
        bookingId: booking.id,
        toiletId: toilet.id,
        status: "COMPLETED",
        startedAt: new Date(now.getTime() - 20 * 60 * 1000),
        endedAt: new Date(now.getTime() - 5 * 60 * 1000),
      },
    });

    return { booking, session };
  }

  describe("Step 7.1: Review Eligibility Enforcement", () => {
    it("1. Unauthenticated request to submit review is rejected with 401 Unauthorized", async () => {
      const res = await request(app)
        .post(`/api/v1/reviews/toilet/${verifiedToilet.id}`)
        .send({ rating: 5, comment: "Anonymous review" });

      expect(res.status).toBe(401);
    });

    it("2. Owner attempting to review their own toilet is rejected with 403 Forbidden", async () => {
      const res = await request(app)
        .post(`/api/v1/reviews/toilet/${verifiedToilet.id}`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ rating: 5, comment: "I own this toilet and love it!" });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Owners cannot review their own toilets/i);
    });

    it("3. Review for an unverified toilet is rejected with 400 Bad Request", async () => {
      const res = await request(app)
        .post(`/api/v1/reviews/toilet/${unverifiedToilet.id}`)
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ rating: 4, comment: "Great place" });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/unverified/i);
    });

    it("4. Customer with NO bookings at all is rejected with 403 Forbidden", async () => {
      const res = await request(app)
        .post(`/api/v1/reviews/toilet/${verifiedToilet.id}`)
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ rating: 5, comment: "Never visited but rating anyway" });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/completed.*booking|usage session/i);
    });

    it("5. Customer with only a PENDING / unpaid booking is rejected with 403 Forbidden", async () => {
      const now = new Date();
      await prisma.booking.create({
        data: {
          userId: customerUser.id,
          toiletId: verifiedToilet.id,
          amount: 30.0,
          scheduledDate: now,
          startTime: now,
          endTime: new Date(now.getTime() + 60 * 60 * 1000),
          token: "SG-" + Math.floor(100000 + Math.random() * 900000),
          status: "PENDING",
        },
      });

      const res = await request(app)
        .post(`/api/v1/reviews/toilet/${verifiedToilet.id}`)
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ rating: 4, comment: "Booking pending" });

      expect(res.status).toBe(403);
    });

    it("6. Customer with a CANCELLED booking is rejected with 403 Forbidden", async () => {
      const now = new Date();
      await prisma.booking.create({
        data: {
          userId: customerUser.id,
          toiletId: verifiedToilet.id,
          amount: 30.0,
          scheduledDate: now,
          startTime: now,
          endTime: new Date(now.getTime() + 60 * 60 * 1000),
          token: "SG-" + Math.floor(100000 + Math.random() * 900000),
          status: "CANCELLED",
        },
      });

      const res = await request(app)
        .post(`/api/v1/reviews/toilet/${verifiedToilet.id}`)
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ rating: 1, comment: "I cancelled but reviewing" });

      expect(res.status).toBe(403);
    });

    it("7. Customer with a COMPLETED booking & completed session successfully submits review", async () => {
      const { session } = await createCompletedBookingAndSession(customerUser, verifiedToilet);

      const res = await request(app)
        .post(`/api/v1/reviews/toilet/${verifiedToilet.id}`)
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          rating: 5,
          comment: "Spotless and well-maintained!",
          sessionId: session.id,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.review.rating).toBe(5);
      expect(res.body.data.review.comment).toBe("Spotless and well-maintained!");

      // Verify atomic rating aggregation on Toilet record
      const toilet = await prisma.toilet.findUnique({ where: { id: verifiedToilet.id } });
      expect(toilet.averageRating).toBe(5);
      expect(toilet.totalReviews).toBe(1);
    });
  });

  describe("Step 7.2: One Review Per Customer Per Toilet & Upsert Concurrency", () => {
    it("8. Customer submitting a second review on the same toilet updates existing review (Upsert)", async () => {
      // Customer 1 already reviewed with 5 stars. Now updates to 4 stars with new comment.
      const res = await request(app)
        .post(`/api/v1/reviews/toilet/${verifiedToilet.id}`)
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          rating: 4,
          comment: "Updated: Very good but queue was slightly long.",
        });

      expect(res.status).toBe(200);
      expect(res.body.data.review.rating).toBe(4);
      expect(res.body.data.review.comment).toBe("Updated: Very good but queue was slightly long.");

      // Verify DB constraint: Still exactly 1 review exists for Customer 1 on this toilet
      const reviewCount = await prisma.review.count({
        where: { userId: customerUser.id, toiletId: verifiedToilet.id },
      });
      expect(reviewCount).toBe(1);

      // Verify toilet aggregation updated accurately
      const toilet = await prisma.toilet.findUnique({ where: { id: verifiedToilet.id } });
      expect(toilet.averageRating).toBe(4);
      expect(toilet.totalReviews).toBe(1);
    });

    it("9. Second customer with completed session submits review, updating aggregate average", async () => {
      await createCompletedBookingAndSession(otherCustomerUser, verifiedToilet);

      const res = await request(app)
        .post(`/api/v1/reviews/toilet/${verifiedToilet.id}`)
        .set("Authorization", `Bearer ${otherCustomerToken}`)
        .send({
          rating: 2,
          comment: "Water pressure was low.",
        });

      expect(res.status).toBe(200);
      expect(res.body.data.review.rating).toBe(2);

      // Total reviews = 2 (Cust 1 = 4, Cust 2 = 2 => Avg = 3.0)
      const toilet = await prisma.toilet.findUnique({ where: { id: verifiedToilet.id } });
      expect(toilet.totalReviews).toBe(2);
      expect(toilet.averageRating).toBe(3.0);
    });

    it("10. Concurrent review submissions by the same customer resolve cleanly to 1 review", async () => {
      // Fire 3 simultaneous review updates for otherCustomerUser
      const promises = [
        request(app)
          .post(`/api/v1/reviews/toilet/${verifiedToilet.id}`)
          .set("Authorization", `Bearer ${otherCustomerToken}`)
          .send({ rating: 3, comment: "Race 1" }),
        request(app)
          .post(`/api/v1/reviews/toilet/${verifiedToilet.id}`)
          .set("Authorization", `Bearer ${otherCustomerToken}`)
          .send({ rating: 4, comment: "Race 2" }),
        request(app)
          .post(`/api/v1/reviews/toilet/${verifiedToilet.id}`)
          .set("Authorization", `Bearer ${otherCustomerToken}`)
          .send({ rating: 5, comment: "Race 3" }),
      ];

      const results = await Promise.all(promises);
      results.forEach((r) => {
        expect(r.status).toBe(200);
      });

      // Still only 1 review for otherCustomerUser
      const count = await prisma.review.count({
        where: { userId: otherCustomerUser.id, toiletId: verifiedToilet.id },
      });
      expect(count).toBe(1);
    });

    it("11. Deleting a review atomically recalculates average rating and total reviews", async () => {
      const otherReview = await prisma.review.findUnique({
        where: {
          userId_toiletId: {
            userId: otherCustomerUser.id,
            toiletId: verifiedToilet.id,
          },
        },
      });

      const delRes = await request(app)
        .delete(`/api/v1/reviews/${otherReview.id}`)
        .set("Authorization", `Bearer ${otherCustomerToken}`);

      expect(delRes.status).toBe(200);

      // Customer 1's review remains (rating = 4)
      const toilet = await prisma.toilet.findUnique({ where: { id: verifiedToilet.id } });
      expect(toilet.totalReviews).toBe(1);
      expect(toilet.averageRating).toBe(4.0);
    });
  });

  describe("Step 7.3: Rating Calculations & Concurrency Safety", () => {
    let calcToilet;
    let customerA;
    let customerAToken;
    let customerB;
    let customerBToken;
    let bookingA;
    let sessionA;
    let bookingB;
    let sessionB;

    beforeAll(async () => {
      const ts = Date.now();

      // Create a dedicated toilet for pure rating math tests
      calcToilet = await prisma.toilet.create({
        data: {
          ownerId: ownerUser.id,
          name: "Math Restroom " + ts,
          address: "123 Math Ave",
          city: "Bengaluru",
          state: "Karnataka",
          country: "India",
          postalCode: "560001",
          price: 50.0,
          latitude: 12.98,
          longitude: 77.60,
          qrToken: "QR_MATH_" + ts,
          isAvailable: true,
          isVerified: true,
        },
      });

      customerA = await prisma.user.create({
        data: {
          fullName: "Customer A",
          email: `cust_a_${ts}@example.com`,
          password: "password123",
          role: "USER",
          isVerified: true,
        },
      });
      customerAToken = generateAccessToken({ id: customerA.id, email: customerA.email, role: customerA.role });

      customerB = await prisma.user.create({
        data: {
          fullName: "Customer B",
          email: `cust_b_${ts}@example.com`,
          password: "password123",
          role: "USER",
          isVerified: true,
        },
      });
      customerBToken = generateAccessToken({ id: customerB.id, email: customerB.email, role: customerB.role });

      const resA = await createCompletedBookingAndSession(customerA, calcToilet);
      bookingA = resA.booking;
      sessionA = resA.session;

      const resB = await createCompletedBookingAndSession(customerB, calcToilet);
      bookingB = resB.booking;
      sessionB = resB.session;
    });

    it("12. Invalid rating values are rejected by validation with 400 Bad Request", async () => {
      // 0, 6, -1, 3.5, string, null
      const invalidRatings = [0, 6, -1, 3.5, "five", null];

      for (const badRating of invalidRatings) {
        const res = await request(app)
          .post(`/api/v1/reviews/toilet/${calcToilet.id}`)
          .set("Authorization", `Bearer ${customerAToken}`)
          .send({ rating: badRating, comment: "Invalid rating test" });

        expect(res.status).toBe(400);
        const bodyStr = JSON.stringify(res.body);
        expect(bodyStr).toMatch(/Rating must be an integer between 1 and 5|Validation failed/i);
      }
    });

    it("13. Review for another customer's booking or session is rejected with 400/403", async () => {
      // Customer A tries to submit a review claiming Customer B's sessionId
      const res = await request(app)
        .post(`/api/v1/reviews/toilet/${calcToilet.id}`)
        .set("Authorization", `Bearer ${customerAToken}`)
        .send({ rating: 5, comment: "Spoofed session", sessionId: sessionB.id });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Invalid or incomplete sessionId/i);

      // Customer A tries to submit a review claiming Customer B's bookingId
      const resBooking = await request(app)
        .post(`/api/v1/reviews/toilet/${calcToilet.id}`)
        .set("Authorization", `Bearer ${customerAToken}`)
        .send({ rating: 5, comment: "Spoofed booking", bookingId: bookingB.id });

      expect(resBooking.status).toBe(403);
      expect(resBooking.body.message).toMatch(/another customer's booking/i);
    });

    it("14. First review: totalReviews becomes 1 and average equals the rating (Rating: 4)", async () => {
      const res = await request(app)
        .post(`/api/v1/reviews/toilet/${calcToilet.id}`)
        .set("Authorization", `Bearer ${customerAToken}`)
        .send({ rating: 4, comment: "First review - solid 4 stars" });

      expect(res.status).toBe(200);

      const toilet = await prisma.toilet.findUnique({ where: { id: calcToilet.id } });
      expect(toilet.totalReviews).toBe(1);
      expect(toilet.averageRating).toBe(4.0);
    });

    it("15. Second customer reviews: Count becomes 2 and average updates correctly (4 + 2 => Avg: 3.0)", async () => {
      const res = await request(app)
        .post(`/api/v1/reviews/toilet/${calcToilet.id}`)
        .set("Authorization", `Bearer ${customerBToken}`)
        .send({ rating: 2, comment: "Second review - 2 stars" });

      expect(res.status).toBe(200);

      const toilet = await prisma.toilet.findUnique({ where: { id: calcToilet.id } });
      expect(toilet.totalReviews).toBe(2);
      expect(toilet.averageRating).toBe(3.0);
    });

    it("16. Edit existing review: Count stays 2; average reflects new rating (2 changed to 5 => Avg: 4.5)", async () => {
      // Customer B changes their review from 2 to 5 stars
      const res = await request(app)
        .post(`/api/v1/reviews/toilet/${calcToilet.id}`)
        .set("Authorization", `Bearer ${customerBToken}`)
        .send({ rating: 5, comment: "Edited: Cleaned up now, 5 stars!" });

      expect(res.status).toBe(200);

      // Verify the specific case from Step 7.3: ratings (4, 5) => total: 2, avg: 4.5
      const toilet = await prisma.toilet.findUnique({ where: { id: calcToilet.id } });
      expect(toilet.totalReviews).toBe(2);
      expect(toilet.averageRating).toBe(4.5);
    });

    it("17. Concurrent submissions by different customers prevent lost updates via pessimistic locking", async () => {
      // Concurrently submit updates from Customer A (rating: 3) and Customer B (rating: 5)
      // Final state must reflect both ratings: (3, 5) => total: 2, avg: 4.0
      const [resA, resB] = await Promise.all([
        request(app)
          .post(`/api/v1/reviews/toilet/${calcToilet.id}`)
          .set("Authorization", `Bearer ${customerAToken}`)
          .send({ rating: 3, comment: "Concurrent A" }),
        request(app)
          .post(`/api/v1/reviews/toilet/${calcToilet.id}`)
          .set("Authorization", `Bearer ${customerBToken}`)
          .send({ rating: 5, comment: "Concurrent B" }),
      ]);

      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);

      const toilet = await prisma.toilet.findUnique({ where: { id: calcToilet.id } });
      expect(toilet.totalReviews).toBe(2);
      expect(toilet.averageRating).toBe(4.0);
    });

    it("18. Deleted reviews recalculate count and average correctly down to zero", async () => {
      // Delete Customer B's review -> only Customer A's rating (3) remains
      const reviewB = await prisma.review.findUnique({
        where: { userId_toiletId: { userId: customerB.id, toiletId: calcToilet.id } },
      });
      const delB = await request(app)
        .delete(`/api/v1/reviews/${reviewB.id}`)
        .set("Authorization", `Bearer ${customerBToken}`);
      expect(delB.status).toBe(200);

      let toilet = await prisma.toilet.findUnique({ where: { id: calcToilet.id } });
      expect(toilet.totalReviews).toBe(1);
      expect(toilet.averageRating).toBe(3.0);

      // Delete Customer A's review -> 0 reviews remain, avg becomes 0
      const reviewA = await prisma.review.findUnique({
        where: { userId_toiletId: { userId: customerA.id, toiletId: calcToilet.id } },
      });
      const delA = await request(app)
        .delete(`/api/v1/reviews/${reviewA.id}`)
        .set("Authorization", `Bearer ${customerAToken}`);
      expect(delA.status).toBe(200);

      toilet = await prisma.toilet.findUnique({ where: { id: calcToilet.id } });
      expect(toilet.totalReviews).toBe(0);
      expect(toilet.averageRating).toBe(0.0);
    });
  });

  describe("Step 7.4: Review API Security & Data Integrity", () => {
    let secToilet;
    let secCustomer;
    let secCustomerToken;
    let victimCustomer;
    let victimCustomerToken;
    let victimReview;

    beforeAll(async () => {
      const ts = Date.now();

      secToilet = await prisma.toilet.create({
        data: {
          ownerId: ownerUser.id,
          name: "Sec Restroom " + ts,
          address: "456 Guard St",
          city: "Bengaluru",
          state: "Karnataka",
          country: "India",
          postalCode: "560001",
          price: 40.0,
          latitude: 12.98,
          longitude: 77.60,
          qrToken: "QR_SEC_" + ts,
          isAvailable: true,
          isVerified: true,
        },
      });

      secCustomer = await prisma.user.create({
        data: {
          fullName: "Security Attacker",
          email: `attacker_${ts}@example.com`,
          password: "password123",
          role: "USER",
          isVerified: true,
        },
      });
      secCustomerToken = generateAccessToken({ id: secCustomer.id, email: secCustomer.email, role: secCustomer.role });

      victimCustomer = await prisma.user.create({
        data: {
          fullName: "Victim Customer",
          email: `victim_${ts}@example.com`,
          password: "password123",
          role: "USER",
          isVerified: true,
        },
      });
      victimCustomerToken = generateAccessToken({ id: victimCustomer.id, email: victimCustomer.email, role: victimCustomer.role });

      // Create completed booking and review for victim
      await createCompletedBookingAndSession(victimCustomer, secToilet);
      const revRes = await request(app)
        .post(`/api/v1/reviews/toilet/${secToilet.id}`)
        .set("Authorization", `Bearer ${victimCustomerToken}`)
        .send({ rating: 5, comment: "Victim initial review" });
      victimReview = revRes.body.data.review;

      // Create completed booking for attacker
      await createCompletedBookingAndSession(secCustomer, secToilet);
    });

    it("19. userId in request body is ignored; review is attributed to authenticated user", async () => {
      // Attacker tries to impersonate victim by passing victim's ID in body
      const res = await request(app)
        .post(`/api/v1/reviews/toilet/${secToilet.id}`)
        .set("Authorization", `Bearer ${secCustomerToken}`)
        .send({
          rating: 4,
          comment: "Attacker attempting impersonation",
          userId: victimCustomer.id,
        });

      // Zod .strict() rejects unexpected property userId with 400
      expect(res.status).toBe(400);

      // Verify that the victim's review remains untouched
      const freshVictimReview = await prisma.review.findUnique({
        where: { id: victimReview.id },
      });
      expect(freshVictimReview.rating).toBe(5);
      expect(freshVictimReview.comment).toBe("Victim initial review");
    });

    it("20. A customer cannot delete another customer's review (403 Forbidden)", async () => {
      // Attacker tries to delete victim's review
      const res = await request(app)
        .delete(`/api/v1/reviews/${victimReview.id}`)
        .set("Authorization", `Bearer ${secCustomerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/permission to delete/i);

      // Victim's review still exists
      const freshVictimReview = await prisma.review.findUnique({
        where: { id: victimReview.id },
      });
      expect(freshVictimReview).not.toBeNull();
    });

    it("21. Submitting review for non-existent toiletId returns 404 Not Found", async () => {
      const nonExistentToiletId = "non_existent_cuid_123456";
      const res = await request(app)
        .post(`/api/v1/reviews/toilet/${nonExistentToiletId}`)
        .set("Authorization", `Bearer ${secCustomerToken}`)
        .send({ rating: 4, comment: "Ghost toilet" });

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/Toilet not found/i);
    });

    it("22. Text fields exceeding length limit (>1000 characters) are rejected with 400 Bad Request", async () => {
      const overlyLongComment = "A".repeat(1001);
      const res = await request(app)
        .post(`/api/v1/reviews/toilet/${secToilet.id}`)
        .set("Authorization", `Bearer ${secCustomerToken}`)
        .send({ rating: 4, comment: overlyLongComment });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/cannot exceed 1000 characters|validation failed/i);
    });

    it("23. Rating aggregates cannot be directly manipulated through toilet update APIs", async () => {
      // Owner tries to set averageRating: 5.0 and totalReviews: 999 directly
      const tamperRes = await request(app)
        .put(`/api/v1/toilets/${secToilet.id}`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          averageRating: 5.0,
          totalReviews: 999,
        });

      // Either rejected by strict schema (400) or stripped during service update
      const toilet = await prisma.toilet.findUnique({ where: { id: secToilet.id } });
      expect(toilet.totalReviews).toBe(1); // Only victim's review
      expect(toilet.averageRating).toBe(5.0);
      expect(toilet.totalReviews).not.toBe(999);
    });
  });
});
