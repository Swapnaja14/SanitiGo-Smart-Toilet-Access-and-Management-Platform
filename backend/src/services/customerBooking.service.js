import prisma from "../config/prisma.js";
import ApiError from "../utils/ApiError.js";
import { recordOutboxEvent } from "./outbox.service.js";

const getOwnedBooking = async (tx, bookingId, userId) => {
  const booking = await tx.booking.findFirst({
    where: {
      id: bookingId,
      userId,
    },
    include: {
      payment: true,
      sessions: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!booking) {
    throw new ApiError(404, "Booking not found.");
  }

  return booking;
};

const ALLOWED_BOOKING_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
];

export const getMyBookings = async (
  userId,
  page = 1,
  limit = 10,
  status
) => {
  if (
    status &&
    !ALLOWED_BOOKING_STATUSES.includes(status)
  ) {
    throw new ApiError(
      400,
      "Invalid booking status filter."
    );
  }

  const where = {
    userId,
    ...(status ? { status } : {}),
  };

  const skip = (page - 1) * limit;

  const [bookings, total] = await prisma.$transaction([
    prisma.booking.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
      select: {
        id: true,
        toiletId: true,
        token: true,
        amount: true,
        scheduledDate: true,
        startTime: true,
        endTime: true,
        status: true,
        createdAt: true,
        toilet: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            price: true,
          },
        },
        payment: {
          select: {
            paymentStatus: true,
            paymentMethod: true,
            currency: true,
            paidAt: true,
          },
        },
      },
    }),
    prisma.booking.count({
      where,
    }),
  ]);

  return {
    bookings,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getMyBookingById = async (bookingId, userId) => {
  const booking = await prisma.booking.findFirst({
    where: {
      id: bookingId,
      userId,
    },
    select: {
      id: true,
      userId: true,
      toiletId: true,
      token: true,
      amount: true,
      scheduledDate: true,
      startTime: true,
      endTime: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      toilet: {
        select: {
          id: true,
          name: true,
          description: true,
          address: true,
          city: true,
          state: true,
          country: true,
          price: true,
          isVerified: true,
          isAvailable: true,
          images: {
            select: {
              imageUrl: true,
              isPrimary: true,
            },
            orderBy: {
              displayOrder: "asc",
            },
          },
          amenities: {
            select: {
              amenity: {
                select: {
                  id: true,
                  name: true,
                  category: true,
                  icon: true,
                },
              },
            },
          },
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
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          startedAt: true,
          endedAt: true,
          duration: true,
          status: true,
        },
      },
    },
  });

  if (!booking) {
    throw new ApiError(404, "Booking not found.");
  }

  return booking;
};

export const cancelMyBooking = async (bookingId, userId) => {
  return prisma.$transaction(async (tx) => {
    const booking = await getOwnedBooking(
      tx,
      bookingId,
      userId
    );

    if (
      booking.status === "CANCELLED" ||
      booking.status === "COMPLETED" ||
      booking.status === "EXPIRED" ||
      booking.status === "IN_PROGRESS"
    ) {
      throw new ApiError(
        400,
        `Booking cannot be cancelled when its status is ${booking.status}.`
      );
    }

    const hasActiveSession = booking.sessions.some(
      (session) => session.status === "ACTIVE"
    );

    if (hasActiveSession) {
      throw new ApiError(
        409,
        "A booking with an active usage session cannot be cancelled."
      );
    }

    // A paid booking requires a separate refund workflow.
    // Never imply that cancellation automatically refunds money.
    if (booking.payment?.paymentStatus === "SUCCESS") {
      throw new ApiError(
        409,
        "This booking has been paid. Refund handling must be completed before cancellation."
      );
    }

    const updatedBooking = await tx.booking.update({
      where: {
        id: booking.id,
      },
      data: {
        status: "CANCELLED",
      },
      select: {
        id: true,
        status: true,
        token: true,
        updatedAt: true,
      },
    });

    // Invalidate an unpaid mock payment so it cannot be reused
    // to confirm the cancelled booking.
    if (booking.payment?.paymentStatus === "PENDING") {
      await tx.payment.update({
        where: {
          id: booking.payment.id,
        },
        data: {
          paymentStatus: "FAILED",
        },
      });
    }

    await recordOutboxEvent(tx, {
      eventType: "booking.cancelled.v1",
      aggregateId: updatedBooking.id,
      data: {
        bookingId: updatedBooking.id,
        customerId: booking.userId,
        toiletId: booking.toiletId,
        previousStatus: booking.status,
        status: updatedBooking.status,
        cancelledAt: updatedBooking.updatedAt.toISOString(),
      },
    });

    return updatedBooking;
  });
};

export default {
  getMyBookings,
  getMyBookingById,
  cancelMyBooking,
};
