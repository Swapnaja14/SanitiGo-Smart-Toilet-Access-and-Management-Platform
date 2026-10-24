import { z } from "zod";

export const initiatePaymentSchema = z
  .object({
    paymentMethod: z.enum([
      "CARD",
      "UPI",
      "NET_BANKING",
      "WALLET",
      "CASH",
    ]),
  })
  .strict();

// Used only by the local mock processor.
// Never use client-supplied outcomes with a real payment gateway.
export const mockPaymentResultSchema = z
  .object({
    outcome: z.enum(["SUCCESS", "FAILED"]),
  })
  .strict();

export const paymentWebhookSchema = z.object({
  bookingId: z.string().min(1, "Booking ID is required").optional(),
  transactionId: z.string().min(1, "Transaction ID is required").optional(),
  amount: z.union([z.number(), z.string()]).optional(),
  status: z.enum(["SUCCESS", "CAPTURED", "FAILED"]).optional(),
  currency: z.string().optional(),
  event: z.string().optional(),
  payload: z.record(z.any()).optional(),
});

export const verifyRazorpayPaymentSchema = z
  .object({
    razorpayOrderId: z.string().min(1, "razorpayOrderId is required"),
    razorpayPaymentId: z.string().min(1, "razorpayPaymentId is required"),
    razorpaySignature: z.string().min(1, "razorpaySignature is required"),
  })
  .strict();

