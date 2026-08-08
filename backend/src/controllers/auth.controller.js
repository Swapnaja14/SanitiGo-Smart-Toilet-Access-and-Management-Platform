import authService from "../services/auth.service.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { refreshTokenCookieOptions } from "../config/cookie.js";
import ApiResponse from "../../utils/ApiResponse.js";

const register = asyncHandler(async (req, res) => {
    const result = await authService.register(req.body);
    res.cookie("refreshToken", result.refreshToken, refreshTokenCookieOptions);
    return res.status(201).json(
        new ApiResponse(
            201,
            {
                user: result.user,
                accessToken: result.accessToken,
            },
            "User Registered successfully"
        )
    );
});

const login = asyncHandler(async (req, res) => {
    const {email, password} = req.body;
    const result = await authService.login(
        email,
        password
    );
    res.cookie(
        "refreshToken",
        result.refreshToken,
        refreshTokenCookieOptions
    );
    return res.status(200).json(
        new ApiResponse(
            200,
            {
                user: result.user,
                accessToken: result.accessToken,
            },
            "Login successful"
        )
    );
});

const refreshToken = asyncHandler(async (req, res) => {
    const token = req.cookies.refreshToken;
    const result = await authService.refreshToken(token);
    res.cookie(
        "refreshToken",
        result.refreshToken,
        refreshTokenCookieOptions
    );
    return res.status(200).json(
        new ApiResponse(
            200,
            {
                accessToken: result.accessToken,
            },
            "Access token refreshed"
        )
    );
});

const logout = asyncHandler(async (req, res) => {
    await authService.logout(req.user.id);
    res.clearCookie("refreshToken", refreshTokenCookieOptions);
    return res.status(200).json(
        new ApiResponse(
            200,
            null,
            "Logout successful"
        )
    );
});

const getCurrentUser = asyncHandler(async (req, res) => {
    const user = await authService.getCurrentUser(req.user.id);
    return res.status(200).json(
        new ApiResponse(
            200,
            user,
            "User fetched successfully"
        )
    );
});

export default {register, login, refreshToken, logout, getCurrentUser};