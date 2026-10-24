import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import crypto from "crypto";

import prisma from "../config/prisma.js";
import ApiError from "../utils/ApiError.js";
import { recordOutboxEvent } from "./outbox.service.js";
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

    if (!booking.amount || Number(booking.amount) <= 0) {
      throw new ApiError(400, "Invalid booking amount configured for this toilet.");
    }

    const existingPayment = booking.payment;

    if (existingPayment?.paymentStatus === "SUCCESS") {
      throw new ApiError(409, "This booking is already paid.");
    }

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
      403,
      "Mock payment endpoint is strictly disabled in production."
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

        await recordOutboxEvent(tx, {
          eventType: "payment.succeeded.v1",
          aggregateId: booking.id,
          data: {
            bookingId: booking.id,
            paymentId: updatedPayment.id,
            customerId: booking.userId,
            toiletId: booking.toiletId,
            amount: updatedPayment.amount.toString(),
            currency: updatedPayment.currency,
            paymentStatus: updatedPayment.paymentStatus,
            bookingStatus: updatedBooking.status,
            paidAt: updatedPayment.paidAt.toISOString(),
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
        maxWait: 10000,
        timeout: 15000,
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
  if (!isDevelopmentMockEnabled()) {
    throw new ApiError(
      403,
      "Direct payment endpoint is strictly disabled in production. Use a verified payment gateway webhook."
    );
  }

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

        await recordOutboxEvent(tx, {
          eventType: "payment.succeeded.v1",
          aggregateId: booking.id,
          data: {
            bookingId: booking.id,
            paymentId: payment.id,
            customerId: booking.userId,
            toiletId: booking.toiletId,
            amount: payment.amount.toString(),
            currency: payment.currency,
            paymentStatus: payment.paymentStatus,
            bookingStatus: confirmedBooking.status,
            paidAt: payment.paidAt.toISOString(),
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

/**
 * Handle real payment provider webhooks (e.g., Stripe, Razorpay).
 *
 * Requirements enforced:
 * 1. Cryptographic HMAC signature verification with timing-safe comparison.
 * 2. Idempotency on provider transaction ID and booking confirmation status.
 * 3. Server-side payment amount reconciliation against booked price snapshot.
 * 4. Atomic database state transition and transactional outbox event creation.
 */
export const handlePaymentWebhook = async ({
  rawBody,
  signature,
  event,
}) => {
  const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new ApiError(500, "Payment webhook secret is not configured.");
  }

  if (!signature) {
    throw new ApiError(401, "Webhook signature is missing.");
  }

  // 1. Verify provider HMAC-SHA256 signature using timing-safe comparison
  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody))
    .digest("hex");

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    throw new ApiError(401, "Invalid webhook signature.");
  }

  const {
    bookingId,
    transactionId,
    amount: providerAmount,
    status: providerStatus,
  } = event;

  if (!bookingId || !transactionId) {
    throw new ApiError(400, "Missing required event fields (bookingId, transactionId).");
  }

  return executeWithRetry(async () => {
    return prisma.$transaction(
      async (tx) => {
        // 2. Idempotency Check: Don't re-process duplicate webhook notifications
        const existingTx = await tx.payment.findFirst({
          where: { transactionId },
        });

        if (existingTx && existingTx.paymentStatus === "SUCCESS") {
          return {
            status: "ALREADY_PROCESSED",
            paymentId: existingTx.id,
            bookingId: existingTx.bookingId,
          };
        }

        const booking = await tx.booking.findUnique({
          where: { id: bookingId },
          include: { payment: true },
        });

        if (!booking) {
          throw new ApiError(404, `Booking ${bookingId} not found.`);
        }

        if (booking.status === "CONFIRMED" && booking.payment?.paymentStatus === "SUCCESS") {
          return {
            status: "ALREADY_CONFIRMED",
            paymentId: booking.payment.id,
            bookingId: booking.id,
          };
        }

        // 3. Server-Side Amount Verification: Never trust client-supplied amounts
        const expectedAmount = Number(booking.amount);
        const receivedAmount = Number(providerAmount);

        if (Math.abs(expectedAmount - receivedAmount) > 0.01) {
          throw new ApiError(
            400,
            `Amount mismatch: expected ${expectedAmount}, received ${receivedAmount}.`
          );
        }

        // 4. Handle failed/canceled payment status from provider
        if (providerStatus !== "SUCCESS" && providerStatus !== "CAPTURED") {
          const failedPayment = await tx.payment.update({
            where: { id: booking.payment.id },
            data: {
              paymentStatus: "FAILED",
              transactionId,
            },
          });

          return {
            status: "PAYMENT_FAILED",
            paymentId: failedPayment.id,
          };
        }

        // 5. Successful payment confirmation & Outbox event
        const updatedPayment = await tx.payment.update({
          where: { id: booking.payment.id },
          data: {
            paymentStatus: "SUCCESS",
            transactionId,
            paidAt: new Date(),
          },
        });

        const updatedBooking = await tx.booking.update({
          where: { id: booking.id },
          data: { status: "CONFIRMED" },
        });

        await recordOutboxEvent(tx, {
          eventType: "payment.succeeded.v1",
          aggregateId: booking.id,
          data: {
            bookingId: booking.id,
            paymentId: updatedPayment.id,
            customerId: booking.userId,
            toiletId: booking.toiletId,
            amount: updatedPayment.amount.toString(),
            currency: updatedPayment.currency,
            paymentStatus: updatedPayment.paymentStatus,
            bookingStatus: updatedBooking.status,
            paidAt: updatedPayment.paidAt.toISOString(),
          },
        });

        return {
          status: "PROCESSED",
          paymentId: updatedPayment.id,
          bookingId: booking.id,
        };
      },
      {
        isolationLevel: "Serializable",
      }
    );
  });
};

export default {
  initiatePayment,
  simulatePaymentResult,
  getPaymentStatus,
  processPayment,
  getPaymentByBookingId,
  handlePaymentWebhook,
};
