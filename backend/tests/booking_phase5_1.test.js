import request from "supertest";
import app from "../src/app.js";
import prisma from "../src/config/prisma.js";
import { generateAccessToken } from "../utils/jwt.js";
import bcrypt from "bcryptjs";

describe("Phase 5.1 — Hardening and Testing Integration Tests", () => {
    let owner;
    let ownerToken;
    let otherOwner;
    let otherOwnerToken;
    let customer1;
    let customer1Token;
    let customer2;
    let customer2Token;
    let singleCapacityToilet;
    let multiCapacityToilet;

    // Helper to generate unique emails
    const uniqueEmail = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}@example.com`;
    const uniquePhone = () => `98${Math.floor(10000000 + Math.random() * 90000000)}`;

    // Helper to format date YYYY-MM-DD
    const getFutureDate = (daysFromNow) => {
        const d = new Date();
        d.setDate(d.getDate() + daysFromNow);
        return d.toISOString().split("T")[0];
    };

    const getPastDate = (daysAgo) => {
        const d = new Date();
        d.setDate(d.getDate() - daysAgo);
        return d.toISOString().split("T")[0];
    };

    beforeAll(async () => {
        // Clean up test database
        await prisma.usageSession.deleteMany();
        await prisma.payment.deleteMany();
        await prisma.booking.deleteMany();
        await prisma.operatingHours.deleteMany();
        await prisma.toilet.deleteMany();
        await prisma.user.deleteMany();

        const hashedPassword = await bcrypt.hash("Password@123", 10);

        // Create main toilet owner
        owner = await prisma.user.create({
            data: {
                fullName: "Toilet Owner",
                email: uniqueEmail("owner"),
                password: hashedPassword,
                phoneNumber: uniquePhone(),
                role: "OWNER",
                isVerified: true,
            },
        });
        ownerToken = generateAccessToken({ id: owner.id, email: owner.email, role: owner.role });

        // Create secondary toilet owner (for wrong-owner access tests)
        otherOwner = await prisma.user.create({
            data: {
                fullName: "Other Owner",
                email: uniqueEmail("other_owner"),
                password: hashedPassword,
                phoneNumber: uniquePhone(),
                role: "OWNER",
                isVerified: true,
            },
        });
        otherOwnerToken = generateAccessToken({ id: otherOwner.id, email: otherOwner.email, role: otherOwner.role });

        // Create customers
        customer1 = await prisma.user.create({
            data: {
                fullName: "Customer One",
                email: uniqueEmail("cust1"),
                password: hashedPassword,
                phoneNumber: uniquePhone(),
                role: "USER",
                isVerified: true,
            },
        });
        customer1Token = generateAccessToken({ id: customer1.id, email: customer1.email, role: customer1.role });

        customer2 = await prisma.user.create({
            data: {
                fullName: "Customer Two",
                email: uniqueEmail("cust2"),
                password: hashedPassword,
                phoneNumber: uniquePhone(),
                role: "USER",
                isVerified: true,
            },
        });
        customer2Token = generateAccessToken({ id: customer2.id, email: customer2.email, role: customer2.role });

        // Create single-capacity toilet (capacity: 1)
        singleCapacityToilet = await prisma.toilet.create({
            data: {
                ownerId: owner.id,
                name: "Express Smart Pod",
                description: "Single pod toilet",
                address: "MG Road Metro",
                city: "Pune",
                state: "Maharashtra",
                country: "India",
                postalCode: "411001",
                latitude: 18.5204,
                longitude: 73.8567,
                price: 25.0,
                capacity: 1,
                qrToken: `QR_POD_${Date.now()}_1`,
                isAvailable: true,
                isVerified: true,
            },
        });

        // Create multi-capacity toilet (capacity: 2)
        multiCapacityToilet = await prisma.toilet.create({
            data: {
                ownerId: owner.id,
                name: "Central Deluxe Smart Restroom",
                description: "Multi-cubicle restroom",
                address: "FC Road",
                city: "Pune",
                state: "Maharashtra",
                country: "India",
                postalCode: "411004",
                latitude: 18.5304,
                longitude: 73.8467,
                price: 30.0,
                capacity: 2,
                qrToken: `QR_POD_${Date.now()}_2`,
                isAvailable: true,
                isVerified: true,
            },
        });

        // Add 7-day operating hours (06:00 to 22:00) for both toilets, with SUNDAY closed on singleCapacityToilet
        const days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
        for (const day of days) {
            await prisma.operatingHours.create({
                data: {
                    toiletId: singleCapacityToilet.id,
                    day,
                    openingTime: "06:00",
                    closingTime: "22:00",
                    isClosed: false,
                },
            });

            await prisma.operatingHours.create({
                data: {
                    toiletId: multiCapacityToilet.id,
                    day,
                    openingTime: "06:00",
                    closingTime: "22:00",
                    isClosed: false,
                },
            });
        }
    });

    afterAll(async () => {
        await prisma.usageSession.deleteMany();
        await prisma.payment.deleteMany();
        await prisma.booking.deleteMany();
        await prisma.operatingHours.deleteMany();
        await prisma.toilet.deleteMany();
        await prisma.user.deleteMany();
        await prisma.$disconnect();
    });

    // ==========================================
    // 1. BOOKING VALIDATION
    // ==========================================
    describe("1. Booking Validation", () => {
        test("should reject invalid calendar date (e.g. 2026-02-31)", async () => {
            const res = await request(app)
                .post("/api/v1/bookings")
                .set("Authorization", `Bearer ${customer1Token}`)
                .send({
                    toiletId: singleCapacityToilet.id,
                    scheduledDate: "2026-02-31",
                    startTime: "10:00",
                    endTime: "10:30",
                    paymentMethod: "UPI",
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/invalid.*date/i);
        });

        test("should reject booking scheduled in the past", async () => {
            const pastDate = getPastDate(2);
            const res = await request(app)
                .post("/api/v1/bookings")
                .set("Authorization", `Bearer ${customer1Token}`)
                .send({
                    toiletId: singleCapacityToilet.id,
                    scheduledDate: pastDate,
                    startTime: "10:00",
                    endTime: "10:30",
                    paymentMethod: "CARD",
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/future/i);
        });

        test("should reject invalid time range where endTime <= startTime", async () => {
            const futureDate = getFutureDate(5);
            const res = await request(app)
                .post("/api/v1/bookings")
                .set("Authorization", `Bearer ${customer1Token}`)
                .send({
                    toiletId: singleCapacityToilet.id,
                    scheduledDate: futureDate,
                    startTime: "14:00",
                    endTime: "13:30",
                    paymentMethod: "WALLET",
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/end time must be after start time/i);
        });

        test("should reject booking outside operating hours (e.g. 05:00 when opens at 06:00)", async () => {
            const futureDate = getFutureDate(5);
            const res = await request(app)
                .post("/api/v1/bookings")
                .set("Authorization", `Bearer ${customer1Token}`)
                .send({
                    toiletId: singleCapacityToilet.id,
                    scheduledDate: futureDate,
                    startTime: "05:00",
                    endTime: "05:45",
                    paymentMethod: "UPI",
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/operating hours/i);
        });
    });

    // ==========================================
    // 2. AVAILABILITY AND CONCURRENCY
    // ==========================================
    describe("2. Availability and Concurrency", () => {
        test("should successfully create first booking in available slot", async () => {
            const futureDate = getFutureDate(7);
            const res = await request(app)
                .post("/api/v1/bookings")
                .set("Authorization", `Bearer ${customer1Token}`)
                .send({
                    toiletId: singleCapacityToilet.id,
                    scheduledDate: futureDate,
                    startTime: "11:00",
                    endTime: "11:30",
                    paymentMethod: "UPI",
                });

            expect(res.statusCode).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.status).toBe("PENDING");
            expect(res.body.data.token).toMatch(/^SG-\d{6}$/);
            expect(res.body.data.payment.paymentStatus).toBe("PENDING");
        });

        test("should reject second booking overlapping with slot when capacity is reached", async () => {
            const futureDate = getFutureDate(7);
            // Overlaps with 11:00 - 11:30
            const res = await request(app)
                .post("/api/v1/bookings")
                .set("Authorization", `Bearer ${customer2Token}`)
                .send({
                    toiletId: singleCapacityToilet.id,
                    scheduledDate: futureDate,
                    startTime: "11:15",
                    endTime: "11:45",
                    paymentMethod: "CARD",
                });

            expect(res.statusCode).toBe(409);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/fully booked/i);
        });

        test("should handle concurrent booking requests: exactly one succeeds for capacity: 1", async () => {
            const futureDate = getFutureDate(8);
            const slot = {
                toiletId: singleCapacityToilet.id,
                scheduledDate: futureDate,
                startTime: "15:00",
                endTime: "15:30",
                paymentMethod: "UPI",
            };

            // Fire two simultaneous requests
            const [res1, res2] = await Promise.all([
                request(app)
                    .post("/api/v1/bookings")
                    .set("Authorization", `Bearer ${customer1Token}`)
                    .send(slot),
                request(app)
                    .post("/api/v1/bookings")
                    .set("Authorization", `Bearer ${customer2Token}`)
                    .send(slot),
            ]);

            const statusCodes = [res1.statusCode, res2.statusCode].sort();
            // Exactly one must be 201 Created and the other must be 409 Conflict
            expect(statusCodes).toEqual([201, 409]);
        });
    });

    // ==========================================
    // 3. PAYMENT CONSISTENCY
    // ==========================================
    describe("3. Payment Consistency", () => {
        let bookingId;

        beforeAll(async () => {
            const futureDate = getFutureDate(9);
            const bookingRes = await request(app)
                .post("/api/v1/bookings")
                .set("Authorization", `Bearer ${customer1Token}`)
                .send({
                    toiletId: singleCapacityToilet.id,
                    scheduledDate: futureDate,
                    startTime: "16:00",
                    endTime: "16:30",
                    paymentMethod: "CARD",
                });
            bookingId = bookingRes.body.data.id;
        });

        test("should atomically confirm booking and set paymentStatus to SUCCESS", async () => {
            const payRes = await request(app)
                .post(`/api/v1/bookings/${bookingId}/payments`)
                .set("Authorization", `Bearer ${customer1Token}`)
                .send({ paymentMethod: "CARD" });

            expect(payRes.statusCode).toBe(200);
            expect(payRes.body.success).toBe(true);
            expect(payRes.body.data.booking.status).toBe("CONFIRMED");
            expect(payRes.body.data.payment.paymentStatus).toBe("SUCCESS");
            expect(payRes.body.data.payment.transactionId).toMatch(/^TXN-[0-9A-F]+$/);
            expect(payRes.body.data.payment.paidAt).toBeDefined();

            // Verify in DB directly
            const dbBooking = await prisma.booking.findUnique({
                where: { id: bookingId },
                include: { payment: true },
            });
            expect(dbBooking.status).toBe("CONFIRMED");
            expect(dbBooking.payment.paymentStatus).toBe("SUCCESS");
        });

        test("should safely reject duplicate payment for already confirmed booking", async () => {
            const duplicatePayRes = await request(app)
                .post(`/api/v1/bookings/${bookingId}/payments`)
                .set("Authorization", `Bearer ${customer1Token}`)
                .send({ paymentMethod: "UPI" });

            expect(duplicatePayRes.statusCode).toBe(400);
            expect(duplicatePayRes.body.success).toBe(false);
            expect(duplicatePayRes.body.message).toMatch(/(already.*confirmed|already.*completed)/i);
        });
    });

    // ==========================================
    // 4. TOKEN AND SESSION SECURITY
    // ==========================================
    describe("4. Token and Session Security", () => {
        let activeBooking;
        let expiredBooking;
        let unpaidBooking;

        beforeAll(async () => {
            const now = new Date();
            // 1. Create currently active booking: started 5 mins ago, ends in 25 mins
            const activeStart = new Date(now.getTime() - 5 * 60 * 1000);
            const activeEnd = new Date(now.getTime() + 25 * 60 * 1000);
            activeBooking = await prisma.booking.create({
                data: {
                    userId: customer1.id,
                    toiletId: singleCapacityToilet.id,
                    scheduledDate: new Date(),
                    startTime: activeStart,
                    endTime: activeEnd,
                    token: "SG-888001",
                    status: "CONFIRMED",
                    payment: {
                        create: {
                            amount: 25.0,
                            currency: "INR",
                            paymentMethod: "UPI",
                            paymentStatus: "SUCCESS",
                            transactionId: "TXN-TEST888001",
                            paidAt: new Date(),
                        },
                    },
                },
                include: { payment: true },
            });

            // 2. Create expired booking: ended 1 hour ago
            const expiredStart = new Date(now.getTime() - 90 * 60 * 1000);
            const expiredEnd = new Date(now.getTime() - 60 * 60 * 1000);
            expiredBooking = await prisma.booking.create({
                data: {
                    userId: customer1.id,
                    toiletId: singleCapacityToilet.id,
                    scheduledDate: new Date(),
                    startTime: expiredStart,
                    endTime: expiredEnd,
                    token: "SG-888002",
                    status: "CONFIRMED",
                    payment: {
                        create: {
                            amount: 25.0,
                            currency: "INR",
                            paymentMethod: "CARD",
                            paymentStatus: "SUCCESS",
                            transactionId: "TXN-TEST888002",
                            paidAt: new Date(),
                        },
                    },
                },
                include: { payment: true },
            });

            // 3. Create unpaid booking (PENDING payment)
            unpaidBooking = await prisma.booking.create({
                data: {
                    userId: customer1.id,
                    toiletId: singleCapacityToilet.id,
                    scheduledDate: new Date(),
                    startTime: activeStart,
                    endTime: activeEnd,
                    token: "SG-888003",
                    status: "PENDING",
                    payment: {
                        create: {
                            amount: 25.0,
                            currency: "INR",
                            paymentMethod: "UPI",
                            paymentStatus: "PENDING",
                        },
                    },
                },
                include: { payment: true },
            });
        });

        test("should reject wrong-owner token verification with 403", async () => {
            const res = await request(app)
                .post("/api/v1/sessions/verify-token")
                .set("Authorization", `Bearer ${otherOwnerToken}`)
                .send({ token: activeBooking.token });

            expect(res.statusCode).toBe(403);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/not authorized/i);
        });

        test("should reject unpaid token with 400", async () => {
            const res = await request(app)
                .post("/api/v1/sessions/verify-token")
                .set("Authorization", `Bearer ${ownerToken}`)
                .send({ token: unpaidBooking.token });

            expect(res.statusCode).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/(payment|status)/i);
        });

        test("should reject expired booking with 400", async () => {
            const res = await request(app)
                .post("/api/v1/sessions/verify-token")
                .set("Authorization", `Bearer ${ownerToken}`)
                .send({ token: expiredBooking.token });

            expect(res.statusCode).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/expired/i);
        });

        test("should start active session for valid token", async () => {
            const res = await request(app)
                .post("/api/v1/sessions/verify-token")
                .set("Authorization", `Bearer ${ownerToken}`)
                .send({ token: activeBooking.token });

            expect(res.statusCode).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.session.status).toBe("ACTIVE");
            expect(res.body.data.session.bookingId).toBe(activeBooking.id);
        });

        test("should reject starting duplicate session when active session exists (409)", async () => {
            const res = await request(app)
                .post("/api/v1/sessions/verify-token")
                .set("Authorization", `Bearer ${ownerToken}`)
                .send({ token: activeBooking.token });

            expect(res.statusCode).toBe(409);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/active session already exists/i);
        });
    });

    // ==========================================
    // 5. CANCELLATION AND SESSION STATES
    // ==========================================
    describe("5. Cancellation and Session States", () => {
        let unconfirmedBooking;
        let confirmedBooking;
        let sessionToComplete;

        beforeAll(async () => {
            const futureDate = getFutureDate(10);
            // Booking 1: Unpaid (PENDING)
            const b1Res = await request(app)
                .post("/api/v1/bookings")
                .set("Authorization", `Bearer ${customer1Token}`)
                .send({
                    toiletId: multiCapacityToilet.id,
                    scheduledDate: futureDate,
                    startTime: "09:00",
                    endTime: "09:30",
                    paymentMethod: "UPI",
                });
            unconfirmedBooking = b1Res.body.data;

            // Booking 2: Paid (CONFIRMED)
            const b2Res = await request(app)
                .post("/api/v1/bookings")
                .set("Authorization", `Bearer ${customer1Token}`)
                .send({
                    toiletId: multiCapacityToilet.id,
                    scheduledDate: futureDate,
                    startTime: "10:00",
                    endTime: "10:30",
                    paymentMethod: "CARD",
                });
            confirmedBooking = b2Res.body.data;

            await request(app)
                .post(`/api/v1/bookings/${confirmedBooking.id}/payments`)
                .set("Authorization", `Bearer ${customer1Token}`)
                .send({ paymentMethod: "CARD" });

            // Booking 3 with active session
            const now = new Date();
            const b3 = await prisma.booking.create({
                data: {
                    userId: customer1.id,
                    toiletId: multiCapacityToilet.id,
                    scheduledDate: new Date(),
                    startTime: new Date(now.getTime() - 5 * 60 * 1000),
                    endTime: new Date(now.getTime() + 25 * 60 * 1000),
                    token: "SG-999001",
                    status: "CONFIRMED",
                    payment: {
                        create: {
                            amount: 30.0,
                            currency: "INR",
                            paymentMethod: "UPI",
                            paymentStatus: "SUCCESS",
                            transactionId: "TXN-TEST999001",
                            paidAt: new Date(),
                        },
                    },
                    sessions: {
                        create: {
                            userId: customer1.id,
                            toiletId: multiCapacityToilet.id,
                            startedAt: now,
                            status: "ACTIVE",
                        },
                    },
                },
                include: { sessions: true },
            });
            sessionToComplete = b3.sessions[0];
        });

        test("should cancel booking before payment (status CANCELLED, payment remains PENDING)", async () => {
            const res = await request(app)
                .patch(`/api/v1/bookings/${unconfirmedBooking.id}/cancel`)
                .set("Authorization", `Bearer ${customer1Token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.status).toBe("CANCELLED");

            const dbPayment = await prisma.payment.findUnique({
                where: { bookingId: unconfirmedBooking.id },
            });
            expect(dbPayment.paymentStatus).toBe("PENDING");
        });

        test("should cancel booking after payment and mark payment as REFUNDED", async () => {
            const res = await request(app)
                .patch(`/api/v1/bookings/${confirmedBooking.id}/cancel`)
                .set("Authorization", `Bearer ${customer1Token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.status).toBe("CANCELLED");
            expect(res.body.data.payment.paymentStatus).toBe("REFUNDED");

            const dbPayment = await prisma.payment.findUnique({
                where: { bookingId: confirmedBooking.id },
            });
            expect(dbPayment.paymentStatus).toBe("REFUNDED");
        });

        test("should end an active session successfully and mark booking as COMPLETED", async () => {
            const res = await request(app)
                .patch(`/api/v1/sessions/${sessionToComplete.id}/end`)
                .set("Authorization", `Bearer ${ownerToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.status).toBe("COMPLETED");
            expect(res.body.data.duration).toBeGreaterThanOrEqual(1);

            // Booking should also transition to COMPLETED
            const dbBooking = await prisma.booking.findUnique({
                where: { id: sessionToComplete.bookingId },
            });
            expect(dbBooking.status).toBe("COMPLETED");
        });

        test("should reject ending an already completed session (400)", async () => {
            const res = await request(app)
                .patch(`/api/v1/sessions/${sessionToComplete.id}/end`)
                .set("Authorization", `Bearer ${ownerToken}`);

            expect(res.statusCode).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/already.*completed/i);
        });

        test("should reject reusing a token whose session is already COMPLETED", async () => {
            const res = await request(app)
                .post("/api/v1/sessions/verify-token")
                .set("Authorization", `Bearer ${ownerToken}`)
                .send({ token: "SG-999001" });

            expect(res.statusCode).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/(already.*used|COMPLETED)/i);
        });
    });
});
