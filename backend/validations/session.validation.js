import { z } from "zod";

export const verifyTokenSchema = z.object({
    token: z.string().regex(/^SG-\d{6}$/, "Invalid booking token format"),
});
