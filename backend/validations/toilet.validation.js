import { z } from "zod";

export const createToiletSchema = z.object({
        name: z
                .string()
                .trim()
                .min(2, "Toilet name must be at least 2 characters")
                .max(100, "Toilet name must not exceed 100 characters"),

        description: z
                .string()
                .trim()
                .max(500, "Description must not exceed 500 characters")
                .optional(),

        address: z
                .string()
                .trim()
                .min(5, "Address must be at least 5 characters"),

        city: z
                .string()
                .trim()
                .min(2, "City is required"),

        state: z
                .string()
                .trim()
                .min(2, "State is required"),

        country: z
                .string()
                .trim()
                .min(2, "Country is required"),

        postalCode: z
                .string()
                .trim()
                .min(3, "Postal code is required")
                .max(10, "Postal code must not exceed 10 characters"),

        latitude: z
                .number()
                .min(-90, "Latitude must be between -90 and 90")
                .max(90, "Latitutde must be between -90 and 90"),

        longitude: z
                .number()
                .min(-180, "Longitude must be between -180 and 180")
                .max(180, "Longitude must be between -180 and 180"),

        price: z
                .number()
                .nonnegative("Price cannot be negative"),

        capacity: z
                .number()
                .int("Capacity must be an integer")
                .positive("Capacity must be greater than 0")
                .optional(),
});

export const updateToiletSchema = createToiletSchema.partial();