import prisma from '../config/prisma.js';
import ApiError from '../../utils/ApiError.js';
import crypto from 'crypto';
import { deleteFromCloudinary, uploadToCloudinary } from '../../utils/cloudinary.js';
import { file } from 'zod';

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
        include: {
            images: {
                orderBy: {
                    displayOrder: "asc",
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

    const updatedToilet = await prisma.toilet.update({
        where: {
            id: toiletId,
        },
        data: {
            ...data,
        },
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


export default {
    createToilet,
    getOwnerToilets,
    getToiletById,
    updateToilet,
    deleteToilet,
    uploadToiletImages,
}