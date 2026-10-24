import { success } from "zod";
import ApiError from "../../utils/ApiError.js";
import asyncHandler from "../../utils/asyncHandler.js";
import toiletService from "../services/toilet.service.js";

export const createToilet = asyncHandler(async(req, res) => {
    const toilet = await toiletService.createToilet(
        req.user.id,
        req.body
    );
    res.status(201).json({
        success: true,
        message: "Toilet registered successfully",
        data: toilet,
    });
});

export const getOwnerToilets = asyncHandler(async (req, res) => {
    const toilets = await toiletService.getOwnerToilets(
        req.user.id
    );
    res.status(200).json({
        success: true,
        message: "Owner toilets retrieved successfully",
        data: toilets,
    });
});

export const getToiletId = asyncHandler(async (req, res) => {
    const toilet = await toiletService.getToiletById(
        req.params.toiletId
    );
    res.status(200).json({
        success: true,
        message: "Toilet retrieved successfully",
        data: toilet,
    });
});

export const updateToilet = asyncHandler(async(req, res) => {
    const toilet = await toiletService.updateToilet(
        req.params.toiletId,
        req.user.id,
        req.body
    );

    res.status(200).json({
        success: true,
        message: "Toilet updated successfully",
        data: toilet,
    });
});

export const deleteToilet = asyncHandler(async(req, res) => {
    await toiletService.deleteToilet(
        req.params.toiletId,
        req.user.id
    );

    res.status(200).json({
        success: true,
        message: "Toilet deleted successfully",
    });
});


export const uploadToiletImages = asyncHandler(async (req, res) => {
    const images = await toiletService.uploadToiletImages(
        req.params.toiletId,
        req.user.id,
        req.files
    );

    res.status(201).json({
        success: true,
        message: "Toilet images uploaded successfully",
        data: images,
    });
});

export const searchToilets = asyncHandler(async(req, res) => {
    const query = req.query.q || "";

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const minPrice = 
        req.query.minPrice !== undefined
        ? Number(req.query.minPrice)
        : undefined;

    const maxPrice =
        req.query.maxPrice !== undefined
        ? Number(req.query.maxPrice)
        : undefined;

    const minRating =
        req.query.minRating !== undefined
        ? Number(req.query.minRating)
        : undefined;

    let isAvailable;

    if (req.query.isAvailable !== undefined) {
        isAvailable = req.query.isAvailable === "true";
    }

    let isVerified;
    if (req.query.isVerified !== undefined) {
        isVerified = req.query.isVerified === "true";
    }

    const amenityIds = req.query.amenityIds
        ? req.query.amenityIds.split(",").filter(Boolean)
        : [];

    if (page < 1) {
        throw new ApiError(400, "Page must be at least 1");
    }

    if (limit < 1 || limit > 100) {
        throw new ApiError(400, "Limit must be between 1 and 100");
    }

    if (
        minPrice !== undefined &&
        (!Number.isFinite(minPrice) || minPrice < 0)
    ) {
        throw new ApiError(400, "Invalid minimum price");
    }

    if (
        maxPrice !== undefined && 
        (!Number.isFinite(maxPrice) || maxPrice < 0)
    ) {
        throw new ApiError(400, "Invalid maximum price");
    }

    if (
        minPrice !== undefined && 
        maxPrice !== undefined && 
        minPrice > maxPrice
    ) {
        throw new ApiError(400, "Minimum price cannot exceed maximum price");
    }

    if (minRating !== undefined &&
        (!Number.isFinite(minRating) || minRating < 0 || minRating > 5)
    ) {
        throw new ApiError(400, "Rating must be between 0 and 5");
    }

    const result = await toiletService.searchToilets(
        query,
        page,
        limit,
        {
            city: req.query.city,
            minPrice,
            maxPrice,
            minRating,
            isAvailable,
            isVerified,
            amenityIds
        }
    );
    
    res.status(200).json({
        success: true,
        message: "Toilets fetched successfully",
        data: result,
    });
});

export const getNearbyToilets = asyncHandler(async(req, res) => {
    const latitude = Number(req.query.latitude);
    const longitude = Number(req.query.longitude);
    const radius = Number(req.query.radius) || 5;

    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
        throw new ApiError(400, "Invalid latitude");
    }

    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        throw new ApiError(400, "Invalid longitude");
    }

    if (!Number.isFinite(radius) || radius < 0 || radius > 100) {
        throw new ApiError(400, "Invalid must be between 0 and 100 kilometers");
    }

    const toilets = await toiletService.getNearbyToilets(
        latitude,
        longitude,
        radius
    );

    res.status(200).json({
        success: true,
        message: "Nearby toilets fetched successfully",
        data: {
            toilets,
            count: toilets.length,
            radius,
        },
    });
});


export const updateOperatingHours = asyncHandler(async(req, res) => {
    const operatingHours = await toiletService.updateOperatingHours(
        req.params.toiletId,
        req.user.id,
        req.body.operatingHours
    );

    res.status(200).json({
        success: true,
        message: "Operating hours updated successfully",
        data: operatingHours,
    });
});


export const updateAmenties = asyncHandler(async(req, res) => {
    const amenities = await toiletService.updateAmenities(
        req.params.toiletId,
        req.user.id,
        req.body.amenityIds
    );

    res.status(200).json({
        success: true,
        message: "Toilet amenities updated successfully",
        data: amenities,
    });
});