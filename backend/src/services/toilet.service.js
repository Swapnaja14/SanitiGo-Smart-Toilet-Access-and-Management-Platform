import prisma from '../config/prisma.js';
import ApiError from '../../utils/ApiError.js';
import crypto from 'crypto';
import { deleteFromCloudinary, uploadToCloudinary } from '../../utils/cloudinary.js';

const createToilet = async(ownerId, data) => {
    const qrToken = crypto.randomBytes(32).toString("hex");

    const toilet = await prisma.toilet.create({
        data: {
            ownerId,
            name: data.name,
            description: data.description,
            address: data.address,
            city: data.city,
            state: data.state,
            country: data.country,
            postalCode: data.postalCode,
            latitude: data.latitude,
            longitude: data.longitude,
            price: data.price,
            capacity: data.capacity ?? 1,
            qrToken,
        },
    });
    return toilet;
};

const getOwnerToilets = async(ownerId) => {
    const toilets = await prisma.toilet.findMany({
        where: {
            ownerId,
        },
        include: {
            images: {
                orderBy: {
                    displayOrder: "asc"
                },
            },
            operatingHours: {
                orderBy: {
                    day: "asc",
                },
            },
            amenities: {
                include: {
                    amenity: true,
                },
            },
        },
        orderBy: {
            createdAt: "desc",
        },
    });

    return toilets;
}

const getToiletById = async(toiletId) => {
    const toilet = await prisma.toilet.findUnique({
        where: {
            id: toiletId,
        },
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
            createdAt: true,
            updatedAt: true,    

            images: {
                orderBy: {
                    displayOrder: "asc",
                },
                select: {
                    id: true,
                    imageUrl: true,
                    isPrimary: true,
                    displayOrder: true,
                },
            },

            operatingHours: {
                orderBy: {
                    day: "asc",
                },
                select: {
                    id: true,
                    day: true,
                    openingTime: true,
                    closingTime: true,
                    isClosed: true,
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
    });

    if (!toilet) {
        throw new ApiError(404, "Toilet not found");
    }
    return toilet;
}

const updateToilet = async(toiletId, ownerId, data) => {
    const toilet = await prisma.toilet.findFirst({
        where: {
            id: toiletId,
            ownerId,
        },
    });
    if (!toilet) {
        throw new ApiError(404, "Toilet not found or you do not own this toilet");
    }

    // Explicitly exclude computed and privileged fields from user updates
    const {
        averageRating: _ignoredAvg,
        totalReviews: _ignoredTotal,
        isVerified: _ignoredVerified,
        ownerId: _ignoredOwnerId,
        id: _ignoredId,
        createdAt: _ignoredCreatedAt,
        updatedAt: _ignoredUpdatedAt,
        ...allowedData
    } = data;

    const updatedToilet = await prisma.toilet.update({
        where: {
            id: toiletId,
        },
        data: allowedData,
    });
    return updatedToilet;
}

const deleteToilet = async(toiletId, ownerId) => {
    const toilet = await prisma.toilet.findFirst({
        where: {
            id: toiletId,
            ownerId,
        },
    });

    if (!toilet) {
        throw new ApiError(404, "Toilet not found or you do not own this toilet");
    }

    await prisma.toilet.delete({
        where: {
            id: toiletId,
            ownerId,   
        },
    });
};

const uploadToiletImages = async (toiletId, ownerId, files) => {
    const toilet = await prisma.toilet.findFirst({
        where: {
            id: toiletId,
            ownerId,
        },
    });

    if (!toilet) {
        throw new ApiError(
            404,
            "Toilet not found or you do not own this toilet"
        );
    }

    if (!files || files.length === 0) {
        throw new ApiError(400, "At least one image is required");
    }

    const imageCount = await prisma.toiletImage.count({
        where: {
            toiletId,
        },
    });

    const uploadedImages = [];

    for (let i = 0; i < files.length; i++) {
        const file = files[i];

        const cloudinaryResult = await uploadToCloudinary(
            file.buffer,
            `sanitigo/toilets/${toiletId}`
        );
        
        try {
            const imageRecord = await prisma.toiletImage.create({
            data: {
                toiletId,
                imageUrl: cloudinaryResult.secure_url,
                publicId: cloudinaryResult.public_id,
                isPrimary: imageCount === 0 && i === 0,
                displayOrder: imageCount + i,
            },
        });
            uploadedImages.push(imageRecord);
        }
        catch(error) {
            await deleteFromCloudinary(cloudinaryResult.public_id);
            throw error;
        }
    }

    return uploadedImages;
};

const searchToilets = async(query, page=1, limit=10, filters={}) => {
    const skip = (page-1) * limit;

    const where = {};

    // Search
    if (query && query.trim()) {
        const search = query.trim();
        where.OR = [
            {
                name: {
                    contains: search,
                    mode: "insensitive",
                },
            },
            {
                description: {
                    contains: search,
                    mode: "insensitive",
                },
            },
            {
                address: {
                    contains: search,
                    mode: "insensitive",
                },
            },
            {
                city: {
                    contains: search,
                    mode: "insensitive",
                },
            },
            {
                state: {
                    contains: search,
                    mode: "insensitive",
                },
            },
            {
                postalCode: {
                    contains: search,
                    mode: "insensitive",
                },
            },
        ];
    }

    // City filter
    if (filters.city) {
        where.city = {
            equals: filters.city,
            mode: "insensitive",
        };  
    }

    // Price filter
    if (
        filters.minPrice !== undefined ||
        filters.maxPrice !== undefined
    ) {
        where.price = {};

        if (filters.minPrice !== undefined) {
            where.price.gte = filters.minPrice;
        }

        if (filters.maxPrice !== undefined) {
            where.price.lte = filters.maxPrice;
        }
    }

    // Rating filter
    if (filters.minRating !== undefined) {
        where.averageRating = {
            gte: filters.minRating,
        };
    }

    // Availibility filter
    if (filters.isAvailable !== undefined) {
        where.isAvailable = filters.isAvailable;
    } else {
        // Customers should normally see only available toilets
        where.isAvailable = true;
    }

    // Verification filter
    if (filters.isVerified !== undefined) {
        where.isVerified = filters.isVerified;
    }

    // Amenity filter
    if (filters.amenityIds && filters.amenityIds.length > 0) {
        where.amenities = {
            some: {
                amenityId: {
                    in: filters.amenityIds,
                },
            },
        };
    }

    const [toilets, total] = await Promise.all([
        prisma.toilet.findMany({
            where,
            skip,
            take: limit,
            include: {
                images: {
                    orderBy: {
                        displayOrder: "asc",
                    },
                },
                amenities: {
                    include: {
                        amenity: true,
                    },
                },
            },
            orderBy: {
                averageRating: "desc",
            },
        }),

        prisma.toilet.count({
            where,
        }),
    ]);

    return {
        toilets,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total/limit),
        },
    };
};


const getNearbyToilets = async(latitude, longitude, radius=5) => {
    const toilets = await prisma.toilet.findMany({
        where: {
            isAvailable: true,
        },
        include: {
            images: {
                orderBy: {
                    displayOrder: "asc",
                },
            },
            amenities: {
                include: {
                    amenity: true,
                },
            },
        },
    });

    const earthRadiusKm = 6371;

    const nearbyToilets = toilets.map((toilet) => {
        const lat1 = (latitude * Math.PI) / 180;
        const lat2 = (toilet.latitude * Math.PI) / 180;
        const deltaLatitude = ((toilet.latitude - latitude) * Math.PI) / 180;
        const deltaLongitude = ((toilet.longitude - longitude) * Math.PI) / 180;

        const a = Math.sin(deltaLatitude / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLongitude / 2)**2;

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        const distance = earthRadiusKm * c;

        return {
            ...toilet,
            distance: Number(distance.toFixed(2)),
        };
    })
    .filter((toilet) => toilet.distance <= radius)
    .sort((a,b) => a.distance - b.distance);

    return nearbyToilets;
}


const updateOperatingHours = async(toiletId, ownerId, operatingHours) => {
    // Verify that the toilet belongs to the owner
    const toilet = await prisma.toilet.findFirst({
        where: {
            id: toiletId,
            ownerId,
        },
    });

    if (!toilet) {
        throw new ApiError(404, "Toilet not found or you do not own this toilet.");
    }

    // Replace the existing weekly schedule
    await prisma.operatingHours.deleteMany({
        where: {
            toiletId,
        },
    });

    await prisma.operatingHours.createMany({
        data: operatingHours.map((hours) => ({
            toiletId,
            day: hours.day,
            openingTime: hours.openingTime,
            closingTime: hours.closingTime,
            isClosed: hours.isClosed,
        })),
    });

    return prisma.operatingHours.findMany({
        where: {
            toiletId,
        },
        orderBy: {
            day: "asc",
        },
    });
};

// const updateAmenties = async(toiletId, ownerId, amenityIds) => {
//     // Verify ownership
//     const toilet = await prisma.toilet.findFirst({
//         where: {
//             id: toiletId,
//             ownerId,
//         },
//     });

//     if (!toilet) {
//         throw new ApiError(404, "Toilet not found or you do not own this toilet");
//     }

//     if (amenityIds.length > 0) {
//         const amenities = await prisma.amenity.findMany({
//             where: {
//                 id: {
//                     in: amenityIds,
//                 },
//             },
//         });

//         if (amenities.length !== amenityIds.length) {
//             throw new ApiError(400, "One or more amenities do not exist");
//         }
//     }

//     // Remove existing amenities
//     await prisma.toiletAmenity.deleteMany({
//         where: {
//             toiletId,
//         },
//     });

//     // No amenities selected
//     if (amenityIds.length === 0) {
//         return [];
//     }

//     // Verify all amenities exist
//     const amenities = await prisma.amenity.findMany({
//         where: {
//             id: {
//                 in: amenityIds,
//             },
//         },
//     });

//     if (amenities.length !== amenityIds.length) {
//         throw new ApiError(400, "One or more amenities does not exist");
//     }

//     // Create new associations
//     await prisma.toiletAmenity.createMany({
//         data: amenityIds.map((amenityId) => ({
//             toiletId,
//             amenityId,
//         })),
//     });

//     // Return updated amenities
//     return prisma.toiletAmenity.findMany({
//         where: {
//             toiletId,
//         },
//         include: {
//             amenity: true,
//         },
//     });
// };



const updateAmenities = async(toiletId, ownerId, amenityIds) => {
    const toilet = await prisma.toilet.findFirst({
        where: {
            id: toiletId,
            ownerId,
        },
    });

    if (!toilet) {
        throw new ApiError(404, "Toilet not found or you do not own this toilet");
    }

    // Validate amenity IDs before making any database changes
    if (amenityIds.length > 0) {
        const amenities = await prisma.amenity.findMany({
            where: {
                id: {
                    in: amenityIds,
                },
            },
        });

        if (amenities.length !== amenityIds.length) {
            throw new ApiError(400, "One or more amenities do not exist");
        }
    }

    // Update amenities inside a transaction
    await prisma.$transaction(async(tx) => {
        // Remove existing amenities
        await tx.toiletAmenity.deleteMany({
            where: {
                toiletId,
            },
        });

        // Add new amenities if any are selected
        if (amenityIds.length > 0) {
            await tx.toiletAmenity.createMany({
                data: amenityIds.map((amenityId) => ({
                    toiletId,
                    amenityId,
                })),
            });
        }
    });

    // Return updated amenities
    return prisma.toiletAmenity.findMany({
        where: {
            toiletId,
        },
        include: {
            amenity: true,
        },
    });
};


const getAllAmenities = async () => {
    return prisma.amenity.findMany({
        orderBy: { name: 'asc' },
    });
};

const getOwnerBookings = async (ownerId) => {
    return prisma.booking.findMany({
        where: {
            toilet: {
                ownerId,
            },
        },
        include: {
            toilet: {
                select: {
                    id: true,
                    name: true,
                    address: true,
                    city: true,
                },
            },
            payment: {
                select: {
                    id: true,
                    amount: true,
                    currency: true,
                    paymentStatus: true,
                    paymentMethod: true,
                    paidAt: true,
                },
            },
            user: {
                select: {
                    id: true,
                    fullName: true,
                    email: true,
                    phoneNumber: true,
                },
            },
            sessions: {
                orderBy: { createdAt: "desc" },
                take: 1,
            },
        },
        orderBy: {
            createdAt: "desc",
        },
    });
};

export default {
    createToilet,
    getOwnerToilets,
    getToiletById,
    updateToilet,
    deleteToilet,
    uploadToiletImages,
    searchToilets,
    getNearbyToilets,
    updateOperatingHours,
    updateAmenities,
    getAllAmenities,
    getOwnerBookings,
};