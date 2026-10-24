import {
  createBookingSchema,
  paymentMethodSchema,
} from "../src/validators/booking.schema.js";

import { generateBookingToken } from "../src/utils/bookingToken.js";

console.log("=== TEST B: VALID BOOKING & PAYMENT METHOD ===");
const startTime = new Date(Date.now() + 60 * 60 * 1000);
const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);

const scheduledDate = new Date(
  Date.UTC(
    startTime.getUTCFullYear(),
    startTime.getUTCMonth(),
    startTime.getUTCDate()
  )
);

const booking = {
  toiletId: "test-toilet-id",
  scheduledDate: scheduledDate.toISOString(),
  startTime: startTime.toISOString(),
  endTime: endTime.toISOString(),
};

const bookingResult = createBookingSchema.safeParse(booking);

console.log("Booking validation:", bookingResult.success);
console.log("Booking errors:", bookingResult.error?.issues ?? []);

const paymentResult = paymentMethodSchema.safeParse({
  paymentMethod: "UPI",
});

console.log("Payment method validation:", paymentResult.success);

console.log("Generated token:", generateBookingToken());

console.log("\n=== TEST C: REJECTING INVALID CASES ===");

const invalidCases = [
  {
    name: "Empty toiletId",
    data: { ...booking, toiletId: "" },
  },
  {
    name: "Missing startTime",
    data: { toiletId: "test-toilet-id", scheduledDate: scheduledDate.toISOString(), endTime: endTime.toISOString() },
  },
  {
    name: "Invalid datetime string",
    data: { ...booking, scheduledDate: "invalid-date" },
  },
  {
    name: "Start time in the past",
    data: {
      ...booking,
      startTime: new Date(Date.now() - 3600000).toISOString(),
    },
  },
  {
    name: "End time before start time",
    data: {
      ...booking,
      startTime: new Date(Date.now() + 7200000).toISOString(),
      endTime: new Date(Date.now() + 3600000).toISOString(),
    },
  },
  {
    name: "Extra field such as amount",
    data: { ...booking, amount: 25 },
  },
];

for (const testCase of invalidCases) {
  const result = createBookingSchema.safeParse(testCase.data);
  console.log(`- ${testCase.name}: rejected = ${!result.success}`);
}

const invalidPayment = paymentMethodSchema.safeParse({ paymentMethod: "BITCOIN" });
console.log(`- Unsupported payment method: rejected = ${!invalidPayment.success}`);
