import prisma from "../config/prisma.js";
import ApiError from "../../utils/ApiError.js";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

function parsePagination(query) {
    const page = Math.max(1, parseInt(query.page) || DEFAULT_PAGE);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit) || DEFAULT_LIMIT));
    return { page, limit };
}

export async function createOrUpdateReview(userId, toiletId, { rating, comment, sessionId }) {
    if (!rating || rating < 1 || rating > 5) {
        throw new ApiError(400, "Rating must be an integer between 1 and 5.");
    }

    const toilet = await prisma.toilet.findUnique({
        where: { id: toiletId },
        select: { id: true, name: true },
    });

    if (!toilet) {
        throw new ApiError(404, "Toilet not found.");
    }

    if (sessionId) {
        const session = await prisma.usageSession.findFirst({
            where: {
                id: sessionId,
                booking: { userId, toiletId },
            },
        });
        if (!session) {
            throw new ApiError(400, "Invalid sessionId for this toilet and user.");
        }
    }

    return await prisma.$transaction(async (tx) => {
        const review = await tx.review.upsert({
            where: {
                userId_toiletId: {
                    userId,
                    toiletId,
                },
            },
            update: {
                rating,
                comment: comment?.trim() || null,
                sessionId: sessionId || null,
            },
            create: {
                userId,
                toiletId,
                sessionId: sessionId || null,
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

        // Recalculate average rating and total reviews
        const aggregations = await tx.review.aggregate({
            where: { toiletId },
            _avg: { rating: true },
            _count: { rating: true },
        });

        await tx.toilet.update({
            where: { id: toiletId },
            data: {
                averageRating: Number((aggregations._avg.rating || 0).toFixed(1)),
                totalReviews: aggregations._count.rating || 0,
            },
        });

        return review;
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

    await prisma.$transaction(async (tx) => {
        await tx.review.delete({
            where: { id: reviewId },
        });

        // Recalculate average rating and total reviews
        const aggregations = await tx.review.aggregate({
            where: { toiletId },
            _avg: { rating: true },
            _count: { rating: true },
        });

        await tx.toilet.update({
            where: { id: toiletId },
            data: {
                averageRating: Number((aggregations._avg.rating || 0).toFixed(1)),
                totalReviews: aggregations._count.rating || 0,
            },
        });
    });

    return { success: true, message: "Review deleted successfully." };
}

export default {
    createOrUpdateReview,
    getToiletReviews,
    getMyReviews,
    deleteReview,
};
