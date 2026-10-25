import userRepository from "../repositories/user.repository.js";
import { hashPassword, comparePassword} from "../../utils/password.js";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken} from "../../utils/jwt.js";
import ApiError from "../../utils/ApiError.js";

class AuthService {
    async generateAuthTokens(user) {
        // JWT payload
        const payload = {
            id: user.id,
            email: user.email,
            role: user.role,
        };
        // Generate tokens
        const accessToken = generateAccessToken(payload);
        const refreshToken = generateRefreshToken(payload);
        // Store hashed refresh token
        const hashedRefreshToken = await hashPassword(refreshToken);
        await userRepository.updateRefreshToken(
            user.id,
            hashedRefreshToken  
        );
        // Remove sensitive fields
        const {
            password: _password,
            refreshToken: _refreshToken,
            ...safeUser
        } = user;
        return {    
            user: safeUser,
            accessToken,
            refreshToken,
        };
    }

    // async findSafeById(id) {
    //     return prisma.user.findUnique({
    //         where: {id},
    //         select: {
    //             id: true,
    //             fullName: true,
    //             email: true,
    //             phoneNumber: true,
    //             profileImage: true,
    //             role: true,
    //             isVerified: true,
    //             isActive: true,
    //             createdAt: true,
    //             updatedAt: true,
    //             lastLogin: true,
    //         },
    //     });
    // }

    async register(userData) {
        const {fullName, email, password, phoneNumber, role} = userData;
        // Check if user already exists
        const existingUser = await userRepository.findByEmail(email);
        if (existingUser) {
            throw new ApiError(409, "User with this email already exists.");
        }
        // Hash Password
        const hashedPassword = await hashPassword(password);
        const user = await userRepository.create({
            fullName,
            email,
            password: hashedPassword,
            phoneNumber,
            role: role === "OWNER" ? "OWNER" : "USER",
        });
        return await this.generateAuthTokens(user);
    }

    async login(email, password) {
        // Find user by email
        const user = await userRepository.findByEmail(email);
        // Invalid email or password
        if (!user) {
            throw new ApiError(401, "Invalid email or password");
        }
        // Check if account is active
        if (!user.isActive) {
            throw new ApiError(403, "Your account has been deactivated. Please contact support.");
        }
        // Compare passwords
        const isPasswordValid = await comparePassword(
            password,
            user.password
        );
        if (!isPasswordValid) {
            throw new ApiError(401, "Invalid email or password.");
        }
        return await this.generateAuthTokens(user);
    }

    async refreshToken(refreshToken) {
        if (!refreshToken) {
            throw new ApiError(401, "Refresh token is required");
        }
        let decoded;
        // Verify JWT signature
        try {
            decoded = verifyRefreshToken(refreshToken);
        } catch(error) {
            throw new ApiError(401, "Invalid or expired refresh token.");
        }
        // Find User
        const user = await userRepository.findById(decoded.id);
        if (!user) {
            throw new ApiError(401, "User not found");
        }
        // Check account status
        if (!user.isActive) {
            throw new ApiError(403, "Your account has been deactivad");
        }
        // Ensure a new refresh token is created
        if (!user.refreshToken) {
            throw new ApiError(401, "Invalid refresh token");
        }
        // Compare incoming token with stored hashed token
        const isValidRefreshToken = await comparePassword(
            refreshToken,
            user.refreshToken
        );
        if (!isValidRefreshToken) {
            throw new ApiError(401, "Invalid refresh token");
        }
        // Generate new tokens (refresh token rotation)
        const tokens = await this.generateAuthTokens(user);
        return tokens;
    }

    async logout(userId) {
        const user = await userRepository.findById(userId);
        if (!user) {
            throw new ApiError(404, "User not found");
        }
        await userRepository.removeRefreshToken(userId);
        return {
            message: "Logged out successfully",
        };
    }

    async getCurrentUser(userId) {
        const user = await userRepository.findSafeById(userId);
        if (!user) {
            throw new ApiError(404, "User not found");
        }
        return user;
    }

    async updateProfile(userId, { fullName, phoneNumber, profileImage }) {
        const user = await userRepository.findById(userId);
        if (!user) {
            throw new ApiError(404, "User not found");
        }
        await userRepository.update(userId, {
            fullName: fullName !== undefined ? fullName.trim() : undefined,
            phoneNumber: phoneNumber !== undefined ? (phoneNumber?.trim() || null) : undefined,
            profileImage: profileImage !== undefined ? profileImage : undefined,
        });
        return await userRepository.findSafeById(userId);
    }
}

export default new AuthService();