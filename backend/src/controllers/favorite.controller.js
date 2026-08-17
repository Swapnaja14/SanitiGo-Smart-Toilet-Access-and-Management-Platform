import { success } from "zod";
import asyncHandler from "../../utils/asyncHandler.js";
import favoriteService from "../services/favorite.service.js";
import ApiError from "../../utils/ApiError.js";

export const saveFavorite = asyncHandler(async(req, res) => {
    console.log("REQ.USER:", req.user);
    console.log("REQ.USER.ID:", req.user?.id);
    console.log("TOILET ID:", req.params.toiletId);

    const favorite = await favoriteService.saveFavorite(
        req.user.id,
        req.params.toiletId
    );

    res.status(200).json({
        success: true,
        message: "Toilet added to favorites",
        data: favorite,
    });
});

export const removeFavorite = asyncHandler(async(req, res) => {
    await favoriteService.removeFavorite(
        req.user.id,
        req.params.toiletId
    );

    res.status(200).json({
        success: true,
        message: "Toilet removed from favorites",
    });
});

export const getFavorites = asyncHandler(async (req, res) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    if (page < 1) {
        throw new ApiError(400, "Page must be at least 1");
    }

    if (limit < 1 || limit > 100) {
        throw new ApiError(400, "Limit must be between 1 and 100");
    }

    const result = await favoriteService.getFavorites(
        req.user.id,
        page,
        limit
    );

    res.status(200).json({
        success: true,
        message: "Favorites retrieved successfully",
        data: result,
    });
});