import dotenv from "dotenv";
dotenv.config();

import prisma from "../src/config/prisma.js";

async function verifyNeonE2E() {
  console.log("=== Testing Neon PostgreSQL Connection End-to-End ===");
  console.log("DATABASE_URL host:", process.env.DATABASE_URL?.split("@")[1]?.split("/")[0]);
  console.log("NEON_BRANCH:", process.env.NEON_BRANCH);

  try {
    // 1. Check database version & current database
    const dbInfo = await prisma.$queryRaw`SELECT version(), current_database(), current_user;`;
    console.log("Database connection successful!");
    console.log("Current Database:", dbInfo[0].current_database);
    console.log("Current User:", dbInfo[0].current_user);
    console.log("Postgres Version:", dbInfo[0].version.split(" on ")[0]);

    // 2. Test reading table metadata
    const userCount = await prisma.user.count();
    const toiletCount = await prisma.toilet.count();
    const bookingCount = await prisma.booking.count();
    console.log(`Current counts in Neon DB -> Users: ${userCount}, Toilets: ${toiletCount}, Bookings: ${bookingCount}`);

    // 3. Test insert and delete to prove write operations on Neon
    const testEmail = `neon_verify_${Date.now()}@example.com`;
    const testUser = await prisma.user.create({
      data: {
        fullName: "Neon Test User",
        email: testEmail,
        password: "test_password_hash",
        role: "USER",
      },
    });
    console.log("Successfully created test record in Neon DB with ID:", testUser.id);

    // Delete test record
    await prisma.user.delete({
      where: { id: testUser.id },
    });
    console.log("Successfully cleaned up test record from Neon DB.");

    console.log("=== Neon PostgreSQL End-to-End Test PASSED ===");
    process.exit(0);
  } catch (err) {
    console.error("Neon E2E verification failed:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyNeonE2E();
