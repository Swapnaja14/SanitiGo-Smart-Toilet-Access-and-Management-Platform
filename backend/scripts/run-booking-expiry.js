import { expireBookings } from "../src/services/bookingExpiry.service.js";
import prisma from "../src/config/prisma.js";

try {
  const count = await expireBookings();
  console.log(`Expired ${count} booking(s).`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
