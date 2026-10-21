import prisma from "../config/prisma.js";

const EXPIRABLE_STATUSES = ["PENDING", "CONFIRMED"];

/**
 * Expires bookings whose access window has ended.
 *
 * IN_PROGRESS bookings are deliberately excluded.
 * A pending payment is marked FAILED so it cannot be reused.
 *
 * Returns the number of bookings expired.
 */
export const expireBookings = async () => {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const expiredBookings = await tx.booking.findMany({
      where: {
        status: {
          in: EXPIRABLE_STATUSES,
        },
        endTime: {
          lte: now,
        },
      },
      select: {
        id: true,
      },
    });

    if (expiredBookings.length === 0) {
      return 0;
    }

    const bookingIds = expiredBookings.map(
      (booking) => booking.id
    );

    // Invalidate any payment that has not succeeded.
    // Failed payments remain failed; refunded/successful payments
    // are not overwritten.
    await tx.payment.updateMany({
      where: {
        bookingId: {
          in: bookingIds,
        },
        paymentStatus: "PENDING",
      },
      data: {
        paymentStatus: "FAILED",
      },
    });

    // Recheck status and time in the UPDATE to avoid expiring a
    // booking that another request has already transitioned.
    const result = await tx.booking.updateMany({
      where: {
        id: {
          in: bookingIds,
        },
        status: {
          in: EXPIRABLE_STATUSES,
        },
        endTime: {
          lte: now,
        },
      },
      data: {
        status: "EXPIRED",
      },
    });

    return result.count;
  });
};

export default {
  expireBookings,
};
