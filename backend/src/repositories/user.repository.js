import prisma from "../config/prisma.js";

class UserRepository {
    // Find User by email
    async findByEmail(email) {
        return await prisma.user.findUnique({
            where: {
                email,
            },
        });
    }

    // Find User by Id
    async findById(id) {
        return await prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                fullName: true,
                email: true,
                role: true,
                isVerified: true,
                isActive: true,
                profileImage: true,
                createdAt: true,
                updatedAt: true,
                lastLogin: true,
                refreshToken: true,
            },
        });
    }

    async findSafeById(id) {
        return await prisma.user.findUnique({
            where: {id},
            select: {
                id: true,
                fullName: true,
                email: true,
                phoneNumber: true,
                profileImage: true,
                role: true,
                isVerified: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
                lastLogin: true
            },
        });
    }

    // Create a new user
    async create(userData) {
        return await prisma.user.create({
            data: userData,
        });
    }

    // Update refresh token
    async updateRefreshToken(userId, refreshToken) {
        return await prisma.user.update({
            where: {
                id: userId,
            },
            data: {
                refreshToken,   
            },
        });
    }

    // Update last login
    async updateLastLogin(userId) {
        return await prisma.user.update({
            where: {
                id: userId,
            },
            data: {
                lastLogin: new Date(),
            },
        });
    }

    // Remove refresh token
    async removeRefreshToken(userId) {
        return await prisma.user.update({
            where: {
                id: userId,
            },
            data: {
                refreshToken: null, 
            },
        });
    }

    // Update User
    async update(userId, data) {
        return await prisma.user.update({
            where: {
                id: userId,
            },
            data,
        });
    }
}

export default new UserRepository();