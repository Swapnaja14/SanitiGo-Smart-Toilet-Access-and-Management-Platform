import asyncHandler from "../../utils/asyncHandler.js";
import {
    listUsers,
    toggleUserStatus,
    listAllToilets,
    verifyToilet,
    getPlatformStats,
} from "../services/admin.service.js";

export const getUsers = asyncHandler(async (req, res) => {
    const result = await listUsers(req.query);

    res.status(200).json({
        success: true,
        message: "Users retrieved successfully.",
        data: result,
    });
});

export const setUserStatus = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { isActive } = req.body;

    const user = await toggleUserStatus(userId, Boolean(isActive));

    res.status(200).json({
        success: true,
        message: `User account has been ${user.isActive ? "activated" : "deactivated"}.`,
        data: { user },
    });
});

export const getToilets = asyncHandler(async (req, res) => {
    const result = await listAllToilets(req.query);

    res.status(200).json({
        success: true,
        message: "Toilets retrieved successfully.",
        data: result,
    });
});

export const setToiletVerification = asyncHandler(async (req, res) => {
    const { toiletId } = req.params;
    const { isVerified } = req.body;

    const toilet = await verifyToilet(toiletId, Boolean(isVerified));

    res.status(200).json({
        success: true,
        message: `Toilet ${toilet.isVerified ? "verified" : "unverified"} successfully.`,
        data: { toilet },
    });
});

export const getStats = asyncHandler(async (req, res) => {
    const stats = await getPlatformStats();

    res.status(200).json({
        success: true,
        message: "Platform analytics retrieved successfully.",
        data: { stats },
    });
});
