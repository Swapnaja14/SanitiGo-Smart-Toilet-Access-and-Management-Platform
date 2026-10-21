import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import crypto from "crypto";

import prisma from "../config/prisma.js";
import ApiError from "../utils/ApiError.js";
import { executeWithRetry } from "../../utils/transactionRetry.js";

const isDevelopmentMockEnabled = () =>
  process.env.PAYMENT_MODE === "mock" &&
  process.env.NODE_ENV !== "production";

const getCustomerBooking = async (tx, bookingId, userId) => {
  const booking = await tx.booking.findFirst({
    where: {
      id: bookingId,
      userId,
    },
    include: {
      payment: true,
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
    },
  });

  if (!booking) {
    throw new ApiError(404, "Booking not found.");
  }

  return booking;
};

export const initiatePayment = async (
  bookingId,
  userId,
  paymentMethod
) => {
  return prisma.$transaction(async (tx) => {
    const booking = await getCustomerBooking(
      tx,
      bookingId,
      userId
    );

    if (
      booking.status !== "PENDING" &&
      booking.status !== "CONFIRMED"
    ) {
      throw new ApiError(
        400,
        "Payment cannot be initiated for this booking."
      );
    }

    if (booking.payment?.paymentStatus === "SUCCESS") {
      throw new ApiError(409, "This booking is already paid.");
    }

    if (booking.status === "CONFIRMED") {
      throw new ApiError(
        409,
        "Booking is already confirmed."
      );
    }

    const existingPayment = booking.payment;

    if (existingPayment?.paymentStatus === "PENDING") {
      return existingPayment;
    }

    if (existingPayment) {
      // Reuse the one-to-one payment record after a failed attempt.
      return tx.payment.update({
        where: { id: existingPayment.id },
        data: {
          paymentMethod,
          amount: booking.amount,
          paymentStatus: "PENDING",
          transactionId: null,
          paidAt: null,
        },
      });
    }

    return tx.payment.create({
      data: {
        bookingId: booking.id,
        amount: booking.amount,
        currency: "INR",
        paymentMethod,
        paymentStatus: "PENDING",
      },
    });
  });
};

export const simulatePaymentResult = async (
  bookingId,
  userId,
  outcome
) => {
  if (!isDevelopmentMockEnabled()) {
    throw new ApiError(
      404,
      "Mock payment endpoint is disabled."
    );
  }

  try {
    return await prisma.$transaction(
      async (tx) => {
        const booking = await getCustomerBooking(
          tx,
          bookingId,
          userId
        );

        if (booking.endTime <= new Date()) {
          throw new ApiError(
            409,
            "This booking's access window has expired. Payment cannot confirm the booking."
          );
        }

        const payment = booking.payment;

        if (!payment) {
          throw new ApiError(
            404,
            "No payment exists for this booking."
          );
        }

        if (payment.paymentStatus === "SUCCESS") {
          if (outcome === "SUCCESS") {
            return {
              payment,
              bookingStatus: booking.status,
              booking,
            };
          }

          throw new ApiError(
            409,
            "A successful payment cannot be changed to failed."
          );
        }

        if (payment.paymentStatus !== "PENDING") {
          throw new ApiError(
            409,
            "No pending payment is available to process."
          );
        }

        if (booking.status !== "PENDING") {
          throw new ApiError(
            409,
            "Booking is not eligible for payment processing."
          );
        }

        if (outcome === "FAILED") {
          const updatedPayment = await tx.payment.update({
            where: { id: payment.id },
            data: {
              paymentStatus: "FAILED",
              transactionId: null,
              paidAt: null,
            },
          });

          return {
            payment: updatedPayment,
            bookingStatus: booking.status,
            booking,
          };
        }

        const updatedPayment = await tx.payment.update({
          where: { id: payment.id },
          data: {
            paymentStatus: "SUCCESS",
            transactionId: `MOCK-${randomUUID()}`,
            paidAt: new Date(),
          },
        });

        const updatedBooking = await tx.booking.update({
          where: { id: booking.id },
          data: {
            status: "CONFIRMED",
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
          },
        });

        return {
          payment: updatedPayment,
          bookingStatus: updatedBooking.status,
          booking: updatedBooking,
        };
      },
      {
        isolationLevel:
          Prisma.TransactionIsolationLevel.Serializable,
      }
    );
  } catch (error) {
    if (error?.code === "P2034") {
      throw new ApiError(
        409,
        "A concurrent request changed this payment. Please check its status and try again."
      );
    }

    throw error;
  }
};

export const getPaymentStatus = async (
  bookingId,
  userId
) => {
  const booking = await prisma.booking.findFirst({
    where: {
      id: bookingId,
      userId,
    },
    select: {
      id: true,
      status: true,
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
          updatedAt: true,
        },
      },
    },
  });

  if (!booking) {
    throw new ApiError(404, "Booking not found.");
  }

  return {
    bookingId: booking.id,
    bookingStatus: booking.status,
    payment: booking.payment,
  };
};

// Compatibility adapter for existing Phase 5.1 direct payment calls
export const processPayment = async (userId, bookingId, paymentMethod) => {
  return executeWithRetry(async () => {
    return prisma.$transaction(
      async (tx) => {
        const booking = await tx.booking.findFirst({
          where: {
            id: bookingId,
            userId,
          },
          include: {
            payment: true,
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
          },
        });

        if (!booking) {
          throw new ApiError(404, "Booking not found");
        }

        if (booking.status === "CANCELLED") {
          throw new ApiError(400, "Cannot make payment for a cancelled booking");
        }
        if (booking.status === "COMPLETED") {
          throw new ApiError(400, "Cannot make payment for a completed booking");
        }
        if (booking.status === "CONFIRMED") {
          throw new ApiError(400, "Booking has already been confirmed");
        }
        if (booking.status !== "PENDING") {
          throw new ApiError(400, "Booking is not eligible for payment");
        }

        if (!booking.payment) {
          throw new ApiError(404, "Payment record not found for this booking");
        }
        if (booking.payment.paymentStatus === "SUCCESS") {
          throw new ApiError(400, "Payment has already been completed for this booking");
        }
        if (booking.payment.paymentStatus === "REFUNDED") {
          throw new ApiError(400, "This payment has already been refunded");
        }

        const randomPart = crypto.randomBytes(6).toString("hex").toUpperCase();
        const transactionId = `TXN-${randomPart}`;

        const payment = await tx.payment.update({
          where: {
            id: booking.payment.id,
          },
          data: {
            paymentMethod,
            paymentStatus: "SUCCESS",
            transactionId,
            paidAt: new Date(),
          },
        });

        const confirmedBooking = await tx.booking.update({
          where: {
            id: booking.id,
          },
          data: {
            status: "CONFIRMED",
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
          },
        });

        return {
          booking: confirmedBooking,
          payment,
        };
      },
      {
        isolationLevel: "Serializable",
      }
    );
  });
};

export const getPaymentByBookingId = async (userId, bookingId) => {
  return getPaymentStatus(bookingId, userId);
};

export default {
  initiatePayment,
  simulatePaymentResult,
  getPaymentStatus,
  processPayment,
  getPaymentByBookingId,
};
