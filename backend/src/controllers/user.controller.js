import asyncHandler from "../../utils/asyncHandler.js";
import prisma from "../config/prisma.js";
import ApiError from "../../utils/ApiError.js";

export const getMyProfile = asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
            id: true,
            fullName: true,
            email: true,
            phoneNumber: true,
            role: true,
            profileImage: true,
            isVerified: true,
            createdAt: true,
        },
    });

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    res.status(200).json({
        success: true,
        data: { user },
    });
});

export const updateMyProfile = asyncHandler(async (req, res) => {
    const { fullName, phoneNumber, profileImage } = req.body;

    const updatedUser = await prisma.user.update({
        where: { id: req.user.id },
        data: {
            ...(fullName && { fullName: fullName.trim() }),
            ...(phoneNumber && { phoneNumber: phoneNumber.trim() }),
            ...(profileImage && { profileImage }),
        },
        select: {
            id: true,
            fullName: true,
            email: true,
            phoneNumber: true,
            role: true,
            profileImage: true,
            isVerified: true,
            updatedAt: true,
        },
    });

    res.status(200).json({
        success: true,
        message: "Profile updated successfully.",
        data: { user: updatedUser },
    });
});

export default {
    getMyProfile,
    updateMyProfile,
};
