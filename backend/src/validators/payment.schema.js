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
