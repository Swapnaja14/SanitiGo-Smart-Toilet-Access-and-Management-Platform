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