import asyncHandler from "../../utils/asyncHandler.js";
import sessionService from "../services/session.service.js";

const verifyTokenAndStartSession = asyncHandler(async (req, res) => {
    const { token } = req.body;

    const result = await sessionService.verifyTokenAndStartSession(
        req.user.id,
        token
    );

    res.status(201).json({
        success: true,
        message: "Token verified and usage session started successfully",
        data: {
            booking: {
                id: result.booking.id,
                token: result.booking.token,
                status: result.booking.status,
                scheduledDate: result.booking.scheduledDate,
                startTime: result.booking.startTime,
                endTime: result.booking.endTime,
            },

            session: {
                id: result.session.id,
                userId: result.session.userId,
                toiletId: result.session.toiletId,
                bookingId: result.session.bookingId,
                startedAt: result.session.startedAt,
                status: result.session.status,
            },
        },
    });
});

const endSession = asyncHandler(async (req, res) => {
    const session = await sessionService.endSession(
        req.user.id,
        req.params.sessionId
    );

    res.status(200).json({
        success: true,
        message: "Usage session ended successfully",
        data: {
            id: session.id,
            userId: session.userId,
            toiletId: session.toiletId,
            bookingId: session.bookingId,
            startedAt: session.startedAt,
            endedAt: session.endedAt,
            duration: session.duration,
            status: session.status,
        },
    });
});

export default {
    verifyTokenAndStartSession,
    endSession,
};
