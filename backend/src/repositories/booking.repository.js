import prisma from "../config/prisma.js";

export const bookingRepository = {
    findById: (id) => prisma.booking.findUnique({ where: { id }, include: { toilet: true, user: true, payment: true } }),
    findByUserId: (userId, options = {}) => prisma.booking.findMany({ where: { userId }, ...options, include: { toilet: true, payment: true } }),
    findByToken: (token) => prisma.booking.findUnique({ where: { token }, include: { toilet: true, payment: true, session: true } }),
    create: (data) => prisma.booking.create({ data }),
    update: (id, data) => prisma.booking.update({ where: { id }, data }),
};

export default bookingRepository;
