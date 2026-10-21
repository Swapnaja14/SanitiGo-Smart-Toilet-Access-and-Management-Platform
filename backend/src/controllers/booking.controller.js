import ApiError from "../../utils/ApiError.js";
import asyncHandler from "../../utils/asyncHandler.js";
import bookingService from "../services/booking.service.js";

export const createBooking = asyncHandler(async (req, res) => {
    // Use the authenticated user's ID, never a client-supplied userId.
    const userId = req.user?.id;

    if (!userId) {
        throw new ApiError(401, "Authentication is required.");
    }

    const booking = await bookingService.createBooking(
        userId,
        req.body
    );

    res.status(201).json({
        success: true,
        message: "Booking created successfully.",
        data: {
            id: booking.id,
            token: booking.token,
            status: booking.status,
            scheduledDate: booking.scheduledDate,
            startTime: booking.startTime,
            endTime: booking.endTime,
            toilet: booking.toilet,
            ...(booking.payment && {
                payment: {
                    id: booking.payment.id,
                    amount: booking.payment.amount,
                    currency: booking.payment.currency,
                    paymentMethod: booking.payment.paymentMethod,
                    paymentStatus: booking.payment.paymentStatus,
                },
            }),
            createdAt: booking.createdAt,
        },
    });
});

export const getMyBookings = asyncHandler(async (req, res) => {
    const bookings = await bookingService.getMyBookings(
        req.user.id,
        req.validatedQuery
    );

    res.status(200).json({
        success: true,
        message: "Bookings fetched successfully",
        data: bookings,
    });
});

export const getBookingById = asyncHandler(async (req, res) => {
    const booking = await bookingService.getBookingById(
        req.user.id,
        req.params.bookingId
    );

    res.status(200).json({
        success: true,
        message: "Booking fetched successfully",
        data: booking,
    });
});

export const cancelBooking = asyncHandler(async (req, res) => {
    const booking = await bookingService.cancelBooking(
        req.user.id,
        req.params.bookingId
    );

    res.status(200).json({
        success: true,
        message: "Booking cancelled successfully",
        data: booking,
    });
});

export default {
    createBooking,
    getMyBookings,
    getBookingById,
    cancelBooking,
};
