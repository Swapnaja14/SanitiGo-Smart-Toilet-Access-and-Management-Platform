import prisma from '../config/prisma.js';
import ApiError from '../../utils/ApiError.js';

const saveFavorite = async(userId, toiletId) => {
    // Check whether the toilet exists
    const toilet = await prisma.toilet.findUnique({
        where: {
            id: toiletId,
        },
    });

    if (!toilet) {
        throw new ApiError(400, "Toilet not found");
    }

    // Check whether the toilet is available
    if (!toilet.isAvailable) {
        throw new ApiError(400, "Cannot favorite an unavailable toilet");
    }

    // Check whether it is already favorited
    const existingFavorite = await prisma.favorite.findUnique({
        where: {
            userId_toiletId: {
                userId,
                toiletId,
            },
        },
    });

    if (existingFavorite) {
        throw new ApiError(409, "Toilet is already in your favorites");
    }

    const favorite = await prisma.favorite.create({
        data: {
            userId,
            toiletId,
        },
        include: {
            toilet: {
                select: {
                    id: true,
                    name: true,
                    address: true,
                    city: true,
                    price: true,
                    averageRating: true,
                    totalReviews: true,
                    isAvailable: true,
                    images: {
                        orderBy: {
                            displayOrder: "asc",
                        },
                    },  
                },
            },
        },
    });

    return favorite;
};


const removeFavorite = async(userId, toiletId) => {
    const favorite = await prisma.favorite.findUnique({
        where: {
            userId_toiletId: {
                userId,
                toiletId,
            },
        },
    });

    if (!favorite) {
        throw new ApiError(404, "Toilet is not in your favorites");
    }

    await prisma.favorite.delete({
        where: {
            userId_toiletId: {
                userId,
                toiletId,
            },
        },
    });
};


const getFavorites = async(userId, page=1, limit=10) => {
    const skip = (page-1) * limit;
    const where = {
        userId,
    };

    const [favorites, total] = await Promise.all([
        prisma.favorite.findMany({
            where,
            skip,
            take: limit,

            orderBy: {
                createdAt: "desc",
            },
            include: {
                toilet: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        address: true,
                        city: true,
                        state: true,
                        country: true,
                        postalCode: true,
                        latitude: true,
                        longitude: true,
                        price: true,
                        averageRating: true,
                        totalReviews: true,
                        isVerified: true,
                        isAvailable: true,
                        capacity: true,

                        images: {
                            orderBy: {
                                displayOrder: "asc",
                            },
                            take: 1,
                            select: {
                                id: true,
                                imageUrl: true,
                                isPrimary: true,
                            },
                        },

                        amenities: {
                            select: {
                                amenity: {
                                    select: {
                                        id: true,
                                        name: true,
                                        category: true,
                                        icon: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        }),

        prisma.favorite.count({
            where,
        }),
    ]);

    return {
        favorites,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total/limit),
        },
    };
};

export default {
    saveFavorite,
    removeFavorite,
    getFavorites,
};