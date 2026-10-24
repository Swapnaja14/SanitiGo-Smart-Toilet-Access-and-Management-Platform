import request from "supertest";
import app from "../src/app.js";
import prisma from "../src/config/prisma.js";

describe("Authentication API", () => {
    beforeAll(async () => {
        await prisma.usageSession.deleteMany();
        await prisma.payment.deleteMany();
        await prisma.booking.deleteMany();
        await prisma.toilet.deleteMany();
        await prisma.user.deleteMany();
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    test("GET unknown authentication route should return 404", async() => {
        const response = await request(app).get("/api/v1/auth/unknown");
        expect(response.statusCode).toBe(404);
    });

    // Test Registration
    test("should register a new user", async() => {
        const uniqueEmail = `test_${Date.now()}@example.com`;

        const response = await request(app)
        .post("/api/v1/auth/register")
        .send({
            fullName: "Test User",
            email: uniqueEmail,
            password: "Password@123",
            phoneNumber: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
        });

        expect(response.statusCode).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toMatch(/user registered successfully/i);
        expect(response.body.data.user.email).toBe(uniqueEmail);
        expect(response.body.data.accessToken).toBeDefined();
        expect(
            response.headers["set-cookie"].some(
                (cookie) => cookie.startsWith("refreshToken=")
            )
        ).toBe(true);
    });

    // Test Validation
    test("should reject registration with invalid data", async() => {
        const response = await request(app)
        .post("/api/v1/auth/register")
        .send({
            fullName: "A",
            email: "invalid-email",
            password: "123",
        });
        expect(response.statusCode).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe("Validation failed");
    });

    // Test Duplicate Registration
    test("should reject duplicate email registration", async() => {
        const email = `duplicate_${Date.now()}@example.com`;
        const user = {
            fullName: "Duplicate user",
            email,
            password: "Password@123",
            phoneNumber: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
        };
        const firstResponse = await request(app)
        .post("/api/v1/auth/register")
        .send(user);

        expect(firstResponse.statusCode).toBe(201);

        const secondResponse = await request(app)
        .post("/api/v1/auth/register")
        .send(user);

        expect(secondResponse.statusCode).toBe(409);
        expect(secondResponse.body.success).toBe(false);
    });

    // Test Login
    test("should login with valid credentials", async() => {
        const email = `login_${Date.now()}@example.com`;
        // Register first
        await request(app)
        .post("/api/v1/auth/register")
        .send({
            fullName: "Login Test User",
            email,
            password: "Password@123",
            phoneNumber: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
        });

        // Now login
        const response = await request(app)
        .post("/api/v1/auth/login")
        .send({
            email,
            password: "Password@123",
        });

        expect(response.statusCode).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.user).toBeDefined();
        expect(response.body.data.accessToken).toBeDefined();
        expect(response.headers["set-cookie"]).toBeDefined();
    });

    // Test Wrong Password
    test("should reject login with incorrect password", async() => {
        const email = `wrong_password_${Date.now()}@example.com`;
        await request(app)
        .post("/api/v1/auth/register")
        .send({
            fullName: "Wrong Password User",
            email,
            password: "Password@123",
        });

        const response = await request(app)
        .post("/api/v1/auth/login")
        .send({
            email,
            password: "WrongPassword@123",
        });

        expect(response.statusCode).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe("Invalid email or password.");
    });

    // Test /me without Authentication
    test("should reject /me without access token", async() => {
        const response = await request(app)
        .get("/api/v1/auth/me");

        expect(response.statusCode).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe("Access token is required");
    });

    // Test /me with a valid token
    test("should return current user with valid access token", async() => {
        const email = `me_${Date.now()}@example.com`;
        const registerResponse = await request(app)
        .post("/api/v1/auth/register")
        .send({
            fullName: "Current User",
            email,
            password: "Password@123",
        });

        const accessToken = registerResponse.body.data.accessToken;

        const response = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${accessToken}`);
        expect(response.statusCode).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.email).toBe(email);
    });

    // Test Invalid JWT
    test("should reject an invalid access token", async() => {
        const response = await request(app)
        .get("/api/v1/auth/me")
        .set(
            "Authorization",
            `Bearer invalid.token.here`
        );

        expect(response.statusCode).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe(
            "Invalid or expired access token"
        );
    });

    // Test logout
    test("should logout authenticated user", async() => {
        const email = `logout_${Date.now()}@example.com`;
        
        const loginResponse = await request(app)
        .post("/api/v1/auth/register")
        .send({
            fullName: "Logout User",
            email,
            password: "Password@123",
        });

        const accessToken = loginResponse.body.data.accessToken;

        const response = await request(app)
        .post("/api/v1/auth/logout")
        .set("Authorization",
            `Bearer ${accessToken}`
        );

        expect(response.statusCode).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe("Logout successful");
    });
});