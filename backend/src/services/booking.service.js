import crypto from "crypto";
import prisma from "../config/prisma.js";
import ApiError from "../../utils/ApiError.js";
import { recordOutboxEvent } from "./outbox.service.js";
import {
    createISTDateTime,
    createISTDate,
    isValidCalendarDate,
} from "../../utils/dateTime.js";
import { executeWithRetry } from "../../utils/transactionRetry.js";

const generateBookingToken = async (tx) => {
    for (let attempt = 0; attempt < 10; attempt++) {
        const number = crypto.randomInt(100000, 1000000);
        const token = `SG-${number}`;

        const existingBooking = await tx.booking.findUnique({
            where: {
                token,
            },
            select: {
                id: true,
            },
        });

        if (!existingBooking) {
            return token;
        }
    }

    throw new ApiError(500, "Unable to generate a unique booking token");
};

const getWeekDay = (dateString) => {
    const [year, month, day] = dateString.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    const days = [
        "SUNDAY",
        "MONDAY",
        "TUESDAY",
        "WEDNESDAY",
        "THURSDAY",
        "FRIDAY",
        "SATURDAY",
    ];
    return days[date.getUTCDay()];
};

const timeToMinutes = (time) => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
};

const createBooking = async (
    userId,
    {
        toiletId,
        scheduledDate,
        startTime,
        endTime,
        paymentMethod,
    }
) => {
    // 1. Validate calendar date
    if (!isValidCalendarDate(scheduledDate)) {
        throw new ApiError(400, "Invalid scheduled date");
    }

    const bookingStart = createISTDateTime(scheduledDate, startTime);
    const bookingEnd = createISTDateTime(scheduledDate, endTime);

    // 2. Validate parsed timestamps
    if (
        Number.isNaN(bookingStart.getTime()) ||
        Number.isNaN(bookingEnd.getTime())
    ) {
        throw new ApiError(400, "Invalid booking date or time");
    }

    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);

    if (endMinutes <= startMinutes || bookingEnd <= bookingStart) {
        throw new ApiError(400, "End time must be after start time");
    }

    // 3. Prevent booking in the past
    if (bookingStart <= new Date()) {
        throw new ApiError(400, "Booking must be scheduled for a future time");
    }

    return executeWithRetry(async () => {
        return prisma.$transaction(
            async (tx) => {
                // Fetch toilet details
                const toilet = await tx.toilet.findUnique({
                    where: {
                        id: toiletId,
                    },
                    select: {
                        id: true,
                        name: true,
                        price: true,
                        capacity: true,
                        isAvailable: true,
                        ownerId: true,
                    },
                });

                if (!toilet) {
                    throw new ApiError(404, "Toilet not found");
                }

                if (!toilet.isAvailable) {
                    throw new ApiError(400, "This toilet is currently unavailable");
                }

                // Check operating hours
                const weekDay = getWeekDay(scheduledDate);
                const operatingHours = await tx.operatingHours.findUnique({
                    where: {
                        toiletId_day: {
                            toiletId,
                            day: weekDay,
                        },
                    },
                });

                if (!operatingHours) {
                    throw new ApiError(400, "Operating hours are not configured for this day");
                }

                if (operatingHours.isClosed) {
                    throw new ApiError(400, "The toilet is closed on the selected day");
                }

                const openingMinutes = timeToMinutes(operatingHours.openingTime);
                const closingMinutes = timeToMinutes(operatingHours.closingTime);

                if (
                    startMinutes < openingMinutes ||
                    endMinutes > closingMinutes
                ) {
                    throw new ApiError(
                        400,
                        `Booking time must be within operating hours (${operatingHours.openingTime})-(${operatingHours.closingTime})`
                    );
                }

                // Check slot availability against capacity
                const conflictingBookings = await tx.booking.count({
                    where: {
                        toiletId,
                        status: {
                            in: ["PENDING", "CONFIRMED"],
                        },
                        startTime: {
                            lt: bookingEnd,
                        },
                        endTime: {
                            gt: bookingStart,
                        },
                    },
                });

                if (conflictingBookings >= toilet.capacity) {
                    throw new ApiError(
                        409,
                        "The toilet is fully booked for the selected time"
                    );
                }

                // Generate unique token
                const token = await generateBookingToken(tx);

                // Create booking record with price snapshot and pending payment
                const booking = await tx.booking.create({
                    data: {
                        userId,
                        toiletId,
                        amount: toilet.price,
                        scheduledDate: createISTDate(scheduledDate),
                        startTime: bookingStart,
                        endTime: bookingEnd,
                        token,
                        status: "PENDING",
                        payment: {
                            create: {
                                amount: toilet.price,
                                currency: "INR",
                                paymentMethod,
                                paymentStatus: "PENDING",
                            },
                        },
                    },
                    include: {
                        payment: true,
                        toilet: {
                            select: {
                                id: true,
                                name: true,
                                address: true,
                                city: true,
                                price: true,
                            },
                        },
                    },
                });

                await recordOutboxEvent(tx, {
                  eventType: "booking.created.v1",
                  aggregateId: booking.id,
                  data: {
                    bookingId: booking.id,
                    customerId: booking.userId,
                    toiletId: booking.toiletId,
                    scheduledDate: booking.scheduledDate.toISOString(),
                    startTime: booking.startTime.toISOString(),
                    endTime: booking.endTime.toISOString(),
                    amount: booking.amount.toString(),
                    status: booking.status,
                  },
                });

                return booking;
            },
            {
                isolationLevel: "Serializable",
            }
        );
    });
};

const getMyBookings = async (userId, filters = {}) => {
    const { status, type } = filters;
    const where = {
        userId,
    };

    if (status) {
        where.status = status;
    }

    const now = new Date();
    if (type === "past") {
        where.endTime = {
            lt: now,
        };
    } else if (type === "upcoming") {
        where.endTime = {
            gte: now,
        };
    }

    const bookings = await prisma.booking.findMany({
        where,
        orderBy: {
            scheduledDate: "desc",
        },
        include: {
            toilet: {
                select: {
                    id: true,
                    name: true,
                    address: true,
                    city: true,
                    state: true,
                    price: true,
                },
            },
            payment: {
                select: {
                    id: true,
                    amount: true,
                    currency: true,
                    paymentMethod: true,
                    paymentStatus: true,
                    transactionId: true,
                    paidAt: true,
                },
            },
        },
    });

    return bookings;
};

const getBookingById = async (userId, bookingId) => {
    const booking = await prisma.booking.findFirst({
        where: {
            id: bookingId,
            userId,
        },
        include: {
            toilet: {
                select: {
                    id: true,
                    name: true,
                    description: true,
                    address: true,
                    city: true,
                    state: true,
                    country: true,
                    postalCode: true,
                    latitude: true,
                    longitude: true,
                    price: true,
                    averageRating: true,
                    totalReviews: true,
                },
            },
            payment: {
                select: {
                    id: true,
                    amount: true,
                    currency: true,
                    paymentMethod: true,
                    paymentStatus: true,
                    transactionId: true,
                    paidAt: true,
                    createdAt: true,
                },
            },
            sessions: {
                select: {
                    id: true,
                    startedAt: true,
                    endedAt: true,
                    duration: true,
                    status: true,
                },
                orderBy: {
                    startedAt: "desc",
                },
            },
        },
    });

    if (!booking) {
        throw new ApiError(404, "Booking not found");
    }

    return booking;
};

const cancelBooking = async (userId, bookingId) => {
    const booking = await prisma.booking.findFirst({
        where: {
            id: bookingId,
            userId,
        },
        include: {
            payment: true,
            sessions: {
                where: {
                    status: "ACTIVE",
                },
            },
        },
    });

    if (!booking) {
        throw new ApiError(404, "Booking not found");
    }

    if (booking.status === "CANCELLED") {
        throw new ApiError(400, "Booking is already cancelled");
    }

    if (booking.status === "COMPLETED") {
        throw new ApiError(400, "Completed bookings cannot be cancelled");
    }

    if (booking.sessions && booking.sessions.length > 0) {
        throw new ApiError(
            400,
            "Cannot cancel a booking with an active usage session"
        );
    }

    return executeWithRetry(async () => {
        return prisma.$transaction(
            async (tx) => {
                const cancelledBooking = await tx.booking.update({
                    where: {
                        id: booking.id,
                    },
                    data: {
                        status: "CANCELLED",
                    },
                    include: {
                        toilet: {
                            select: {
                                id: true,
                                name: true,
                                address: true,
                                city: true,
                            },
                        },
                        payment: true,
                    },
                });

                // If payment was completed, mark it refunded
                if (
                    booking.payment &&
                    booking.payment.paymentStatus === "SUCCESS"
                ) {
                    await tx.payment.update({
                        where: {
                            id: booking.payment.id,
                        },
                        data: {
                            paymentStatus: "REFUNDED",
                        },
                    });
                    cancelledBooking.payment.paymentStatus = "REFUNDED";
                }

                return cancelledBooking;
            },
            {
                isolationLevel: "Serializable",
            }
        );
    });
};

export {
    createBooking,
    getMyBookings,
    getBookingById,
    cancelBooking,
};

export default {
    createBooking,
    getMyBookings,
    getBookingById,
    cancelBooking,
};
