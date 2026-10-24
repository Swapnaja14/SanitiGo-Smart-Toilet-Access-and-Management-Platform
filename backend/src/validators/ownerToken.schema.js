import { z } from "zod";

export const verifyBookingTokenSchema = z
  .object({
    token: z
      .string()
      .trim()
      .toUpperCase()
      .regex(
        /^SG-\d{6}$/,
        "Token must follow the format SG-123456."
      ),
  })
  .strict();
