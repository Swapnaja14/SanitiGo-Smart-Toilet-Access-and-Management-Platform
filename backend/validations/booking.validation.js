import { z } from "zod";

export const createBookingSchema = z.object({
    toiletId: z
        .string()
        .trim()
        .min(1, "Toilet ID is required"),

    scheduledDate: z
        .string()
        .regex(
            /^\d{4}-\d{2}-\d{2}$/,
            "scheduledDate must be in YYYY-MM-DD format"
        ),

    startTime: z
        .string()
        .regex(
            /^([01]\d|2[0-3]):([0-5]\d)$/,
            "startTime must be in HH:mm format"
        ),

    endTime: z
        .string()
        .regex(
            /^([01]\d|2[0-3]):([0-5]\d)$/,
            "endTime must be in HH:mm format"
        ),

    paymentMethod: z.enum([
        "CARD",
        "UPI",
        "NET_BANKING",
        "WALLET",
        "CASH",
    ]),
});

export const getMyBookingQuerySchema = z.object({
    status: z
        .enum([
            "PENDING",
            "CONFIRMED",
            "CANCELLED",
            "COMPLETED",
        ])
        .optional(),

    type: z
        .enum([
            "upcoming",
            "past",
        ])
        .optional(),
});

export const paymentMethodSchema = z.object({
    paymentMethod: z.enum([
        "CARD",
        "UPI",
        "NET_BANKING",
        "WALLET",
        "CASH",
    ]),
});
