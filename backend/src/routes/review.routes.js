import { Router } from "express";
import {
    addReview,
    getReviewsByToilet,
    getCustomerReviews,
    removeReview,
} from "../controllers/review.controller.js";
import authenticate from "../middlewares/auth.middleware.js";

const router = Router();

// Public / Authenticated read
router.get("/toilet/:toiletId", getReviewsByToilet);

// Customer endpoints
router.get("/my", authenticate, getCustomerReviews);
router.post("/toilet/:toiletId", authenticate, addReview);
router.delete("/:reviewId", authenticate, removeReview);

export default router;
