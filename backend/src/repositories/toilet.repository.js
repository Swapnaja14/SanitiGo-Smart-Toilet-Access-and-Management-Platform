import prisma from "../config/prisma.js";

export const toiletRepository = {
    findById: (id) => prisma.toilet.findUnique({ where: { id }, include: { images: true, amenities: true, operatingHours: true } }),
    findByOwnerId: (ownerId) => prisma.toilet.findMany({ where: { ownerId } }),
    create: (data) => prisma.toilet.create({ data }),
    update: (id, data) => prisma.toilet.update({ where: { id }, data }),
    delete: (id) => prisma.toilet.delete({ where: { id } }),
};

export default toiletRepository;
