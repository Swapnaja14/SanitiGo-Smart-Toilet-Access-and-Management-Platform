import { z } from "zod";

export const processPaymentSchema = z.object({
    paymentMethod: z.enum(["CARD", "UPI", "NET_BANKING", "WALLET", "CASH"]),
});
