import prisma from "../config/prisma.js";
import ApiError from "../utils/ApiError.js";

const TIME_ZONE = process.env.APP_TIME_ZONE || "Asia/Kolkata";
const EARLY_ACCESS_MINUTES = 15;

export const verifyBookingToken = async (ownerId, token) => {
  const booking = await prisma.booking.findUnique({
    where: { token },
    include: {
      toilet: {
        select: {
          id: true,
          name: true,
          ownerId: true,
          address: true,
          city: true,
        },
      },
      payment: {
        select: {
          paymentStatus: true,
          amount: true,
          currency: true,
          paidAt: true,
        },
      },
    },
  });

  if (!booking) {
    throw new ApiError(404, "Invalid booking token.");
  }

  // Do not allow owners to verify bookings belonging to other owners.
  if (booking.toilet.ownerId !== ownerId) {
    throw new ApiError(403, "You are not authorized to verify this booking.");
  }

  if (booking.status !== "CONFIRMED") {
    throw new ApiError(
      409,
      `Booking is not eligible for verification. Current status: ${booking.status}.`
    );
  }

  if (booking.payment?.paymentStatus !== "SUCCESS") {
    throw new ApiError(
      409,
      "Payment has not been confirmed for this booking."
    );
  }

  const now = new Date();
  const earliestAccess = new Date(
    booking.startTime.getTime() -
      EARLY_ACCESS_MINUTES * 60 * 1000
  );

  if (now < earliestAccess) {
    throw new ApiError(
      409,
      "This booking is not yet within its access window."
    );
  }

  if (now >= booking.endTime) {
    throw new ApiError(
      409,
      "This booking's access window has expired."
    );
  }

  return {
    verified: true,
    message: "Booking token verified successfully.",
    booking: {
      id: booking.id,
      token: booking.token,
      status: booking.status,
      scheduledDate: booking.scheduledDate,
      startTime: booking.startTime,
      endTime: booking.endTime,
      amount: booking.amount,
      toilet: booking.toilet,
      payment: {
        paymentStatus: booking.payment.paymentStatus,
        amount: booking.payment.amount,
        currency: booking.payment.currency,
        paidAt: booking.payment.paidAt,
      },
    },
    accessWindow: {
      earliestAccess,
      expiresAt: booking.endTime,
      timeZone: TIME_ZONE,
    },
  };
};

export default {
  verifyBookingToken,
};
