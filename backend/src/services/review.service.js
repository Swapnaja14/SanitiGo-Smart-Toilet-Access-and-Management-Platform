import prisma from "../config/prisma.js";
import ApiError from "../../utils/ApiError.js";
import { Prisma } from "@prisma/client";
import { executeWithRetry } from "../../utils/transactionRetry.js";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

function parsePagination(query) {
    const page = Math.max(1, parseInt(query.page) || DEFAULT_PAGE);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit) || DEFAULT_LIMIT));
    return { page, limit };
}

export async function createOrUpdateReview(userId, toiletId, { rating, comment, sessionId, bookingId }) {
    if (
        rating === undefined ||
        rating === null ||
        typeof rating !== "number" ||
        isNaN(rating) ||
        !Number.isInteger(rating) ||
        rating < 1 ||
        rating > 5
    ) {
        throw new ApiError(400, "Rating must be an integer between 1 and 5.");
    }

    const toilet = await prisma.toilet.findUnique({
        where: { id: toiletId },
        select: {
            id: true,
            name: true,
            ownerId: true,
            isVerified: true,
            isAvailable: true,
        },
    });

    if (!toilet) {
        throw new ApiError(404, "Toilet not found.");
    }

    // 1. Business Rule: Owners cannot review their own toilets
    if (toilet.ownerId === userId) {
        throw new ApiError(403, "Owners cannot review their own toilets.");
    }

    // 2. Business Rule: Unverified or unavailable toilets cannot be reviewed
    if (!toilet.isVerified) {
        throw new ApiError(400, "Reviews cannot be submitted for unverified toilets.");
    }
    if (!toilet.isAvailable) {
        throw new ApiError(400, "Reviews cannot be submitted for unavailable toilets.");
    }

    // 3. Business Rule: If a specific bookingId is passed, it must belong to this user & toilet and be COMPLETED/PAID
    if (bookingId) {
        const specificBooking = await prisma.booking.findFirst({
            where: {
                id: bookingId,
                userId,
                toiletId,
                status: "COMPLETED",
                payment: { paymentStatus: "SUCCESS" },
            },
        });
        if (!specificBooking) {
            throw new ApiError(
                403,
                "You cannot submit a review for another customer's booking or an uncompleted booking."
            );
        }
    }

    // 4. Business Rule: Customer must have a qualifying completed booking or usage session
    // Cancelled, expired, pending, or unpaid bookings strictly DO NOT qualify.
    const qualifyingBooking = await prisma.booking.findFirst({
        where: {
            userId,
            toiletId,
            status: "COMPLETED",
            payment: {
                paymentStatus: "SUCCESS",
            },
        },
        include: {
            sessions: {
                where: {
                    status: "COMPLETED",
                },
            },
        },
    });

    const qualifyingSession = await prisma.usageSession.findFirst({
        where: {
            status: "COMPLETED",
            booking: {
                userId,
                toiletId,
                payment: {
                    paymentStatus: "SUCCESS",
                },
            },
        },
    });

    if (!qualifyingBooking && !qualifyingSession) {
        throw new ApiError(
            403,
            "You can only review a toilet after completing a verified booking and usage session."
        );
    }

    let resolvedSessionId = sessionId || null;
    if (sessionId) {
        const session = await prisma.usageSession.findFirst({
            where: {
                id: sessionId,
                status: "COMPLETED",
                booking: { userId, toiletId },
            },
        });
        if (!session) {
            throw new ApiError(400, "Invalid or incomplete sessionId for this toilet and user.");
        }
    } else if (qualifyingSession) {
        resolvedSessionId = qualifyingSession.id;
    } else if (qualifyingBooking?.sessions?.[0]) {
        resolvedSessionId = qualifyingBooking.sessions[0].id;
    }

    return executeWithRetry(async () => {
        try {
            return await prisma.$transaction(async (tx) => {
                // Pessimistic lock on the Toilet row to serialize concurrent rating calculations
                // and prevent lost updates
                await tx.$queryRaw`SELECT id FROM "Toilet" WHERE id = ${toiletId} FOR UPDATE;`;

                const review = await tx.review.upsert({
                    where: {
                        userId_toiletId: {
                            userId,
                            toiletId,
                        },
                    },
                    update: {
                        rating,
                        comment: comment !== undefined ? (comment?.trim() || null) : undefined,
                        sessionId: resolvedSessionId,
                    },
                    create: {
                        userId,
                        toiletId,
                        sessionId: resolvedSessionId,
                        rating,
                        comment: comment?.trim() || null,
                    },
                    include: {
                        user: {
                            select: {
                                id: true,
                                fullName: true,
                                profileImage: true,
                            },
                        },
                    },
                });

                // Recalculate average rating and total reviews atomically while holding the lock
                const aggregations = await tx.review.aggregate({
                    where: { toiletId },
                    _avg: { rating: true },
                    _count: { rating: true },
                });

                const newTotal = aggregations._count.rating || 0;
                const newAvg = newTotal > 0 ? Number((aggregations._avg.rating || 0).toFixed(1)) : 0;

                await tx.toilet.update({
                    where: { id: toiletId },
                    data: {
                        averageRating: newAvg,
                        totalReviews: newTotal,
                    },
                });

                return review;
            }, {
                maxWait: 10000,
                timeout: 15000,
            });
        } catch (error) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === "P2002"
            ) {
                return await prisma.review.findUnique({
                    where: { userId_toiletId: { userId, toiletId } },
                    include: {
                        user: {
                            select: {
                                id: true,
                                fullName: true,
                                profileImage: true,
                            },
                        },
                    },
                });
            }
            throw error;
        }
    });
}

export async function getToiletReviews(toiletId, query = {}) {
    const { page, limit } = parsePagination(query);

    const toilet = await prisma.toilet.findUnique({
        where: { id: toiletId },
        select: { id: true, averageRating: true, totalReviews: true },
    });

    if (!toilet) {
        throw new ApiError(404, "Toilet not found.");
    }

    const [reviews, total] = await Promise.all([
        prisma.review.findMany({
            where: { toiletId },
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: "desc" },
            include: {
                user: {
                    select: {
                        id: true,
                        fullName: true,
                        profileImage: true,
                    },
                },
            },
        }),
        prisma.review.count({ where: { toiletId } }),
    ]);

    return {
        reviews,
        summary: {
            averageRating: toilet.averageRating,
            totalReviews: toilet.totalReviews,
        },
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}

export async function getMyReviews(userId, query = {}) {
    const { page, limit } = parsePagination(query);

    const [reviews, total] = await Promise.all([
        prisma.review.findMany({
            where: { userId },
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: "desc" },
            include: {
                toilet: {
                    select: {
                        id: true,
                        name: true,
                        city: true,
                        address: true,
                    },
                },
            },
        }),
        prisma.review.count({ where: { userId } }),
    ]);

    return {
        reviews,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}

export async function deleteReview(userId, reviewId, userRole = "USER") {
    const review = await prisma.review.findUnique({
        where: { id: reviewId },
    });

    if (!review) {
        throw new ApiError(404, "Review not found.");
    }

    if (review.userId !== userId && userRole !== "ADMIN") {
        throw new ApiError(403, "You do not have permission to delete this review.");
    }

    const toiletId = review.toiletId;

    return executeWithRetry(async () => {
        return await prisma.$transaction(async (tx) => {
            // Pessimistic lock on the Toilet row to prevent race conditions on delete
            await tx.$queryRaw`SELECT id FROM "Toilet" WHERE id = ${toiletId} FOR UPDATE;`;

            await tx.review.delete({
                where: { id: reviewId },
            });

            // Recalculate average rating and total reviews atomically
            const aggregations = await tx.review.aggregate({
                where: { toiletId },
                _avg: { rating: true },
                _count: { rating: true },
            });

            const newTotal = aggregations._count.rating || 0;
            const newAvg = newTotal > 0 ? Number((aggregations._avg.rating || 0).toFixed(1)) : 0;

            await tx.toilet.update({
                where: { id: toiletId },
                data: {
                    averageRating: newAvg,
                    totalReviews: newTotal,
                },
            });

            return { success: true, message: "Review deleted successfully." };
        }, {
            maxWait: 10000,
            timeout: 15000,
        });
    });
}

export default {
    createOrUpdateReview,
    getToiletReviews,
    getMyReviews,
    deleteReview,
};
