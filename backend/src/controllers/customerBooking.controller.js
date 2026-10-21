import {
  getMyBookings as getMyBookingsService,
  getMyBookingById as getMyBookingByIdService,
  cancelMyBooking as cancelMyBookingService,
} from "../services/customerBooking.service.js";

import ApiError from "../utils/ApiError.js";

const getAuthenticatedUserId = (req) => {
  const userId = req.user?.id;

  if (!userId) {
    throw new ApiError(401, "Authentication is required.");
  }

  return userId;
};

export const getMyBookings = async (req, res, next) => {
  try {
    const userId = getAuthenticatedUserId(req);

    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);

    if (
      !Number.isInteger(page) ||
      !Number.isInteger(limit) ||
      page < 1 ||
      limit < 1 ||
      limit > 50
    ) {
      throw new ApiError(
        400,
        "Page must be a positive integer and limit must be between 1 and 50."
      );
    }

    const status =
      typeof req.query.status === "string"
        ? req.query.status.toUpperCase()
        : undefined;

    const result = await getMyBookingsService(
      userId,
      page,
      limit,
      status
    );

    return res.status(200).json({
      success: true,
      message: "Bookings retrieved successfully.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getMyBookingById = async (req, res, next) => {
  try {
    const userId = getAuthenticatedUserId(req);

    const booking = await getMyBookingByIdService(
      req.params.bookingId,
      userId
    );

    return res.status(200).json({
      success: true,
      message: "Booking retrieved successfully.",
      data: booking,
    });
  } catch (error) {
    next(error);
  }
};

export const cancelMyBooking = async (req, res, next) => {
  try {
    const userId = getAuthenticatedUserId(req);

    const booking = await cancelMyBookingService(
      req.params.bookingId,
      userId
    );

    return res.status(200).json({
      success: true,
      message: "Booking cancelled successfully.",
      data: booking,
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getMyBookings,
  getMyBookingById,
  cancelMyBooking,
};
