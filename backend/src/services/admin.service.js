import prisma from "../config/prisma.js";
import ApiError from "../../utils/ApiError.js";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

function parsePagination(query) {
    const page = Math.max(1, parseInt(query.page) || DEFAULT_PAGE);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit) || DEFAULT_LIMIT));
    return { page, limit };
}

export async function listUsers(query = {}) {
    const { page, limit } = parsePagination(query);
    const { role, search, isActive } = query;

    const where = {};
    if (role) {
        where.role = role.toUpperCase();
    }
    if (isActive !== undefined) {
        where.isActive = isActive === "true";
    }
    if (search) {
        where.OR = [
            { fullName: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
        ];
    }

    const [users, total] = await Promise.all([
        prisma.user.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                fullName: true,
                email: true,
                role: true,
                isActive: true,
                isVerified: true,
                phoneNumber: true,
                createdAt: true,
                lastLogin: true,
                _count: {
                    select: {
                        bookings: true,
                        toilets: true,
                    },
                },
            },
        }),
        prisma.user.count({ where }),
    ]);

    return {
        users,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}

export async function toggleUserStatus(userId, isActive) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
    });

    if (!user) {
        throw new ApiError(404, "User not found.");
    }

    const updated = await prisma.user.update({
        where: { id: userId },
        data: { isActive },
        select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
            isActive: true,
        },
    });

    return updated;
}

export async function listAllToilets(query = {}) {
    const { page, limit } = parsePagination(query);
    const { isVerified, isAvailable, search } = query;

    const where = {};
    if (isVerified !== undefined) {
        where.isVerified = isVerified === "true";
    }
    if (isAvailable !== undefined) {
        where.isAvailable = isAvailable === "true";
    }
    if (search) {
        where.OR = [
            { name: { contains: search, mode: "insensitive" } },
            { city: { contains: search, mode: "insensitive" } },
            { address: { contains: search, mode: "insensitive" } },
        ];
    }

    const [toilets, total] = await Promise.all([
        prisma.toilet.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: "desc" },
            include: {
                owner: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                    },
                },
            },
        }),
        prisma.toilet.count({ where }),
    ]);

    return {
        toilets,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}

export async function verifyToilet(toiletId, isVerified) {
    const toilet = await prisma.toilet.findUnique({
        where: { id: toiletId },
    });

    if (!toilet) {
        throw new ApiError(404, "Toilet not found.");
    }

    const updated = await prisma.toilet.update({
        where: { id: toiletId },
        data: { isVerified },
    });

    return updated;
}

export async function getPlatformStats() {
    const [
        totalUsers,
        totalCustomers,
        totalOwners,
        totalToilets,
        verifiedToilets,
        totalBookings,
        completedBookings,
        paymentStats,
        sessionCount,
    ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { role: "USER" } }),
        prisma.user.count({ where: { role: "OWNER" } }),
        prisma.toilet.count(),
        prisma.toilet.count({ where: { isVerified: true } }),
        prisma.booking.count(),
        prisma.booking.count({ where: { status: "COMPLETED" } }),
        prisma.payment.aggregate({
            _count: { id: true },
            _sum: { amount: true },
            where: { paymentStatus: "SUCCESS" },
        }),
        prisma.usageSession.count(),
    ]);

    return {
        users: {
            total: totalUsers,
            customers: totalCustomers,
            owners: totalOwners,
        },
        toilets: {
            total: totalToilets,
            verified: verifiedToilets,
            unverified: totalToilets - verifiedToilets,
        },
        bookings: {
            total: totalBookings,
            completed: completedBookings,
        },
        financials: {
            successfulTransactions: paymentStats._count.id || 0,
            totalRevenue: Number(paymentStats._sum.amount || 0),
        },
        sessions: {
            total: sessionCount,
        },
    };
}

export default {
    listUsers,
    toggleUserStatus,
    listAllToilets,
    verifyToilet,
    getPlatformStats,
};
