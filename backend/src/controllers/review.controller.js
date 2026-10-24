import asyncHandler from "../../utils/asyncHandler.js";
import {
    createOrUpdateReview,
    getToiletReviews,
    getMyReviews,
    deleteReview,
} from "../services/review.service.js";

export const addReview = asyncHandler(async (req, res) => {
    const { toiletId } = req.params;
    const { rating, comment, sessionId, bookingId } = req.body;

    const review = await createOrUpdateReview(req.user.id, toiletId, {
        rating: rating !== undefined && rating !== null ? Number(rating) : undefined,
        comment,
        sessionId,
        bookingId,
    });

    res.status(200).json({
        success: true,
        message: "Review submitted successfully.",
        data: { review },
    });
});

export const getReviewsByToilet = asyncHandler(async (req, res) => {
    const { toiletId } = req.params;
    const result = await getToiletReviews(toiletId, req.query);

    res.status(200).json({
        success: true,
        message: "Toilet reviews retrieved successfully.",
        data: result,
    });
});

export const getCustomerReviews = asyncHandler(async (req, res) => {
    const result = await getMyReviews(req.user.id, req.query);

    res.status(200).json({
        success: true,
        message: "User reviews retrieved successfully.",
        data: result,
    });
});

export const removeReview = asyncHandler(async (req, res) => {
    const { reviewId } = req.params;
    const result = await deleteReview(req.user.id, reviewId, req.user.role);

    res.status(200).json({
        success: true,
        message: result.message,
    });
});
