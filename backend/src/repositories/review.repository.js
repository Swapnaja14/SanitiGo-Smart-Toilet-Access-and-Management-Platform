import prisma from "../config/prisma.js";

export const reviewRepository = {
    findById: (id) => prisma.review.findUnique({ where: { id }, include: { user: true, toilet: true } }),
    findByToiletId: (toiletId, options = {}) => prisma.review.findMany({ where: { toiletId }, ...options, include: { user: true } }),
    findByUserId: (userId, options = {}) => prisma.review.findMany({ where: { userId }, ...options, include: { toilet: true } }),
    delete: (id) => prisma.review.delete({ where: { id } }),
};

export default reviewRepository;
