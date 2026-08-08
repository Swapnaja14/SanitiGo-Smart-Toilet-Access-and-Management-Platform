// Authentication answers: Who are you?

import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import userRepository from "../src/repositories/user.repository.js";
import { verifyAccessToken } from "../utils/jwt.js";

const authenticate = asyncHandler(async(req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new ApiError(
            401,
            "Access token is required"
        );
    }

    const token = authHeader.split(" ")[1];
    let decoded;
    try {
        decoded = verifyAccessToken(token);
    } catch {
        throw new ApiError(
            401,
            "Invalid or expired access token"
        );
    }
    const user = await userRepository.findById(decoded.id);
    if (!user) {
        throw new ApiError(
            401,
            "User not found"
        );
    }

    if (!user.isActive) {
        throw new ApiError(
            403,
            "Account has been deactivated"
        );
    }
    req.user = {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
    };
    next();
});

export default authenticate;