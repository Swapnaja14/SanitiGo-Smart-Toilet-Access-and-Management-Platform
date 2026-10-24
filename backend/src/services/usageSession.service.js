import { Prisma } from "@prisma/client";

import prisma from "../config/prisma.js";
import ApiError from "../utils/ApiError.js";
import { recordOutboxEvent } from "./outbox.service.js";

const EARLY_ACCESS_MINUTES = 15;

const getSessionAccessWindow = (booking) => {
  const earliestAccess = new Date(
    booking.startTime.getTime() -
      EARLY_ACCESS_MINUTES * 60 * 1000
  );

  return {
    earliestAccess,
    expiresAt: booking.endTime,
  };
};

export const startUsageSession = async (ownerId, token) => {
  try {
    return await prisma.$transaction(
      async (tx) => {
        const booking = await tx.booking.findUnique({
          where: { token },
          include: {
            toilet: {
              select: {
                id: true,
                name: true,
                ownerId: true,
                isVerified: true,
                isAvailable: true,
              },
            },
            payment: {
              select: {
                paymentStatus: true,
              },
            },
            sessions: {
              select: {
                id: true,
                status: true,
              },
            },
          },
        });

        if (!booking) {
          throw new ApiError(404, "Invalid booking token.");
        }

        if (booking.toilet.ownerId !== ownerId) {
          throw new ApiError(
            403,
            "You are not authorized to start a session for this toilet."
          );
        }

        if (booking.status !== "CONFIRMED") {
          throw new ApiError(
            409,
            `Booking cannot start a session. Current status: ${booking.status}.`
          );
        }

        if (booking.payment?.paymentStatus !== "SUCCESS") {
          throw new ApiError(
            409,
            "A successful payment is required to start a session."
          );
        }

        if (
          !booking.toilet.isVerified ||
          !booking.toilet.isAvailable
        ) {
          throw new ApiError(
            409,
            "This toilet is not currently available for use."
          );
        }

        if (booking.sessions.length > 0) {
          throw new ApiError(
            409,
            "A usage session already exists for this booking."
          );
        }

        const now = new Date();
        const { earliestAccess, expiresAt } =
          getSessionAccessWindow(booking);

        if (now < earliestAccess) {
          throw new ApiError(
            409,
            "This booking is not yet within its access window."
          );
        }

        if (now >= expiresAt) {
          throw new ApiError(
            409,
            "This booking's access window has expired."
          );
        }

        // Conditional update ensures only a CONFIRMED booking
        // can transition to IN_PROGRESS.
        const updated = await tx.booking.updateMany({
          where: {
            id: booking.id,
            status: "CONFIRMED",
          },
          data: {
            status: "IN_PROGRESS",
          },
        });

        if (updated.count !== 1) {
          throw new ApiError(
            409,
            "Booking has already been used or changed."
          );
        }

        const session = await tx.usageSession.create({
          data: {
            userId: booking.userId,
            toiletId: booking.toiletId,
            bookingId: booking.id,
            startedAt: now,
            status: "ACTIVE",
          },
          select: {
            id: true,
            bookingId: true,
            userId: true,
            toiletId: true,
            startedAt: true,
            endedAt: true,
            duration: true,
            status: true,
            createdAt: true,
          },
        });

        await recordOutboxEvent(tx, {
          eventType: "session.started.v1",
          aggregateId: session.id,
          data: {
            sessionId: session.id,
            bookingId: booking.id,
            customerId: booking.userId,
            toiletId: booking.toiletId,
            startedAt: session.startedAt.toISOString(),
            status: session.status,
          },
        });

        return {
          session,
          bookingStatus: "IN_PROGRESS",
          toilet: booking.toilet,
        };
      },
      {
        isolationLevel:
          Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10000,
        timeout: 15000,
      }
    );
  } catch (error) {
    if (error?.code === "P2034") {
      throw new ApiError(
        409,
        "A concurrent request changed this booking. Please check its status and try again."
      );
    }

    throw error;
  }
};

export const endUsageSession = async (
  ownerId,
  sessionId
) => {
  try {
    return await prisma.$transaction(
      async (tx) => {
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
          throw new ApiError(404, "Usage session not found.");
        }

        if (session.toilet.ownerId !== ownerId) {
          throw new ApiError(
            403,
            "You are not authorized to end this session."
          );
        }

        if (session.status !== "ACTIVE" || session.endedAt) {
          throw new ApiError(
            409,
            "This usage session has already ended or is not active."
          );
        }

        if (
          !session.booking ||
          session.booking.status !== "IN_PROGRESS"
        ) {
          throw new ApiError(
            409,
            "The associated booking is not in progress."
          );
        }

        const endedAt = new Date();

        const elapsedMilliseconds =
          endedAt.getTime() - session.startedAt.getTime();

        if (elapsedMilliseconds < 0) {
          throw new ApiError(
            409,
            "Session start time is invalid."
          );
        }

        // Duration is stored in whole minutes, rounded up so
        // any partial minute counts as one minute.
        const duration = Math.ceil(
          elapsedMilliseconds / 60000
        );

        const updatedSession = await tx.usageSession.updateMany({
          where: {
            id: session.id,
            status: "ACTIVE",
            endedAt: null,
          },
          data: {
            endedAt,
            duration,
            status: "COMPLETED",
          },
        });

        if (updatedSession.count !== 1) {
          throw new ApiError(
            409,
            "The session has already been ended."
          );
        }

        const updatedBooking = await tx.booking.updateMany({
          where: {
            id: session.booking.id,
            status: "IN_PROGRESS",
          },
          data: {
            status: "COMPLETED",
          },
        });

        if (updatedBooking.count !== 1) {
          throw new ApiError(
            409,
            "The booking status changed while ending the session."
          );
        }

        await recordOutboxEvent(tx, {
          eventType: "session.completed.v1",
          aggregateId: session.id,
          data: {
            sessionId: session.id,
            bookingId: session.bookingId,
            customerId: session.userId,
            toiletId: session.toiletId,
            startedAt: session.startedAt.toISOString(),
            endedAt: endedAt.toISOString(),
            durationMinutes: duration,
            sessionStatus: "COMPLETED",
            bookingStatus: "COMPLETED",
          },
        });

        return {
          session: {
            id: session.id,
            bookingId: session.bookingId,
            userId: session.userId,
            toiletId: session.toiletId,
            startedAt: session.startedAt,
            endedAt,
            duration,
            status: "COMPLETED",
          },
          bookingStatus: "COMPLETED",
        };
      },
      {
        isolationLevel:
          Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10000,
        timeout: 15000,
      }
    );
  } catch (error) {
    if (error?.code === "P2034") {
      throw new ApiError(
        409,
        "A concurrent request changed this session. Please check its status and try again."
      );
    }

    throw error;
  }
};

export const getUsageSessionById = async (
  ownerId,
  sessionId
) => {
  const session = await prisma.usageSession.findFirst({
    where: {
      id: sessionId,
      toilet: {
        ownerId,
      },
    },
    select: {
      id: true,
      bookingId: true,
      userId: true,
      toiletId: true,
      startedAt: true,
      endedAt: true,
      duration: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      toilet: {
        select: {
          id: true,
          name: true,
          address: true,
          city: true,
        },
      },
      booking: {
        select: {
          id: true,
          token: true,
          status: true,
          scheduledDate: true,
          amount: true,
        },
      },
    },
  });

  if (!session) {
    throw new ApiError(404, "Usage session not found.");
  }

  return session;
};

export default {
  startUsageSession,
  endUsageSession,
  getUsageSessionById,
};
