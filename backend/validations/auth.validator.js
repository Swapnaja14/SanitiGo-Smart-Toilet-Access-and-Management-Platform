import {z} from "zod";

export const registerSchema = z.object({
    fullName: z
        .string()
        .trim()
        .min(3, "Full name must be at least 3 characters")
        .max(100, "Full name cannot exceed 100 characters"),
    
    email: z
        .email("Please provide a valid email address")
        .transform((email) => email.toLowerCase().trim()),

    password: z
        .string()
        .min(8, "Password must be at least 8 characters")
        .max(50, "Password cannot exceed 50 characters")
        .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/,
        "Password must contain uppercase, lowercase, number and special character"
        ),

    phoneNumber: z
        .string()
        .regex(
            /^[6-9]\d{9}$/,
            "Phone number must be a valid 10-digit Indian Mobile number"
        )
        .optional(),

    role: z
        .enum(["USER", "OWNER"])
        .default("USER")
        .optional(),
});

export const loginSchema = z.object({
    email: z
    .email("Please provide a valid email address")
    .transform((email) => email.toLowerCase().trim()),

    password: z
        .string()
        .min(1, "Password is required"),
});

export const refreshTokenSchema = z.object({
    refreshToken: z.string().min(1),
});

export const updateProfileSchema = z.object({
    fullName: z
        .string()
        .trim()
        .min(2, "Full name must be at least 2 characters")
        .max(100, "Full name cannot exceed 100 characters")
        .optional(),
    phoneNumber: z
        .string()
        .regex(/^[6-9]\d{9}$/, "Phone number must be a valid 10-digit Indian Mobile number")
        .optional(),
    profileImage: z.string().url("Profile image must be a valid URL").optional().nullable(),
});

