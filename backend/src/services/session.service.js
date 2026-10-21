import prisma from "../config/prisma.js";
import ApiError from "../../utils/ApiError.js";
import { executeWithRetry } from "../../utils/transactionRetry.js";

const verifyTokenAndStartSession = async (ownerId, token) => {
    return executeWithRetry(async () => {
        return prisma.$transaction(
            async (tx) => {
                // 1. Find booking using token
                const booking = await tx.booking.findUnique({
                    where: {
                        token,
                    },
                    include: {
                        payment: true,
                        toilet: {
                            select: {
                                id: true,
                                name: true,
                                ownerId: true,
                            },
                        },
                    },
                });

                if (!booking) {
                    throw new ApiError(404, "Invalid booking token");
                }

                // 2. Verify toilet ownership
                if (booking.toilet.ownerId !== ownerId) {
                    throw new ApiError(
                        403,
                        "You are not authorized to verify this booking"
                    );
                }

                // 3. Verify booking status
                if (booking.status !== "CONFIRMED") {
                    throw new ApiError(
                        400,
                        `Booking cannot be used because its status is ${booking.status}`
                    );
                }

                // 4. Verify payment
                if (
                    !booking.payment ||
                    booking.payment.paymentStatus !== "SUCCESS"
                ) {
                    throw new ApiError(
                        400,
                        "Booking payment has not been completed"
                    );
                }

                // 5. Verify booking time window
                const now = new Date();

                if (now < booking.startTime) {
                    throw new ApiError(400, "Booking is not active yet");
                }

                if (now >= booking.endTime) {
                    throw new ApiError(400, "Booking has expired");
                }

                // 6. Prevent duplicate sessions (active or previously completed)
                const existingSession = await tx.usageSession.findFirst({
                    where: {
                        bookingId: booking.id,
                    },
                });

                if (existingSession) {
                    if (existingSession.status === "ACTIVE") {
                        throw new ApiError(
                            409,
                            "An active session already exists for this booking"
                        );
                    }
                    throw new ApiError(
                        400,
                        "This booking has already been used"
                    );
                }

                // 7. Create usage session
                const session = await tx.usageSession.create({
                    data: {
                        userId: booking.userId,
                        toiletId: booking.toiletId,
                        bookingId: booking.id,
                        startedAt: now,
                        status: "ACTIVE",
                    },
                });

                return {
                    booking,
                    session,
                };
            },
            {
                isolationLevel: "Serializable",
            }
        );
    });
};

const endSession = async (ownerId, sessionId) => {
    return executeWithRetry(async () => {
        return prisma.$transaction(
            async (tx) => {
                // 1. Find active session
                const session = await tx.usageSession.findUnique({
                    where: {
                        id: sessionId,
                    },
                    include: {
                        toilet: {
                            select: {
                                id: true,
                                name: true,
                                ownerId: true,
                            },
                        },
                        booking: {
                            select: {
                                id: true,
                                status: true,
                            },
                        },
                    },
                });

                if (!session) {
                    throw new ApiError(404, "Usage session not found");
                }

                // 2. Verify owner
                if (session.toilet.ownerId !== ownerId) {
                    throw new ApiError(
                        403,
                        "You are not authorized to end this session"
                    );
                }

                // 3. Verify session is active
                if (session.status !== "ACTIVE") {
                    throw new ApiError(
                        400,
                        `Session cannot be ended because it is already ${session.status.toLowerCase()}`
                    );
                }

                const endedAt = new Date();

                // Duration in minutes
                const duration = Math.max(
                    1,
                    Math.ceil(
                        (endedAt.getTime() - session.startedAt.getTime()) /
                            (1000 * 60)
                    )
                );

                // 4. Complete session
                const completedSession = await tx.usageSession.update({
                    where: {
                        id: session.id,
                    },
                    data: {
                        endedAt,
                        duration,
                        status: "COMPLETED",
                    },
                });

                // 5. Complete booking
                if (
                    session.booking &&
                    session.booking.status === "CONFIRMED"
                ) {
                    await tx.booking.update({
                        where: {
                            id: session.booking.id,
                        },
                        data: {
                            status: "COMPLETED",
                        },
                    });
                }

                return completedSession;
            },
            {
                isolationLevel: "Serializable",
            }
        );
    });
};

export default {
    verifyTokenAndStartSession,
    endSession,
};
