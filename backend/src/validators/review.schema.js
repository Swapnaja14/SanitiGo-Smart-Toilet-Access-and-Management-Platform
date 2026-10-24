import { z } from "zod";

export const addReviewSchema = z
    .object({
        rating: z
            .number({ required_error: "Rating is required" })
            .int("Rating must be an integer between 1 and 5.")
            .min(1, "Rating must be an integer between 1 and 5.")
            .max(5, "Rating must be an integer between 1 and 5."),
        comment: z
            .string()
            .trim()
            .max(1000, "Review comment cannot exceed 1000 characters.")
            .optional()
            .nullable(),
        sessionId: z.string().trim().min(1).optional().nullable(),
        bookingId: z.string().trim().min(1).optional().nullable(),
    })
    .strict();

export default {
    addReviewSchema,
};
