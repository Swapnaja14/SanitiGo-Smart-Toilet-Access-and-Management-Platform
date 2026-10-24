import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import crypto from "crypto";

import prisma from "../config/prisma.js";
import ApiError from "../utils/ApiError.js";
import { recordOutboxEvent } from "./outbox.service.js";
import { executeWithRetry } from "../../utils/transactionRetry.js";
import getRazorpayInstance from "../config/razorpay.js";

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
          ownerId: true,
          owner: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phoneNumber: true,
              businessName: true,
              razorpayAccountId: true,
            },
          },
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
  const payloadToSign = Buffer.isBuffer(rawBody)
    ? rawBody
    : typeof rawBody === "string"
    ? rawBody
    : JSON.stringify(rawBody);

  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(payloadToSign)
    .digest("hex");

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    throw new ApiError(401, "Invalid webhook signature.");
  }

  const rzpPaymentEntity = event.payload?.payment?.entity;
  const bookingId =
    event.bookingId ||
    rzpPaymentEntity?.notes?.bookingId;
  const transactionId =
    event.transactionId ||
    rzpPaymentEntity?.id;
  const providerAmount =
    event.amount !== undefined
      ? event.amount
      : rzpPaymentEntity?.amount !== undefined
      ? rzpPaymentEntity.amount / 100
      : undefined;
  const providerStatus =
    event.status ||
    (event.event === "payment.captured" || rzpPaymentEntity?.status === "captured"
      ? "SUCCESS"
      : event.event === "payment.failed" || rzpPaymentEntity?.status === "failed"
      ? "FAILED"
      : undefined);
  const providerCurrency =
    event.currency ||
    rzpPaymentEntity?.currency;
  const providerOrderId =
    event.orderId ||
    rzpPaymentEntity?.order_id;

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

        if (existingTx) {
          if (existingTx.bookingId !== bookingId) {
            throw new ApiError(
              409,
              "Transaction ID is already associated with another booking."
            );
          }
          if (existingTx.paymentStatus === "SUCCESS") {
            return {
              status: "ALREADY_PROCESSED",
              paymentId: existingTx.id,
              bookingId: existingTx.bookingId,
            };
          }
        }

        const booking = await tx.booking.findUnique({
          where: { id: bookingId },
          include: { payment: true },
        });

        if (!booking) {
          throw new ApiError(404, `Booking ${bookingId} not found.`);
        }

        let paymentRecord = booking.payment;
        if (!paymentRecord) {
          paymentRecord = await tx.payment.create({
            data: {
              bookingId: booking.id,
              amount: booking.amount,
              currency: "INR",
              paymentMethod: "UPI",
              paymentStatus: "PENDING",
            },
          });
        }

        // 3. Prevent old or out-of-order callback from reversing an already successful terminal state
        if (paymentRecord.paymentStatus === "SUCCESS") {
          return {
            status: "ALREADY_PROCESSED",
            paymentId: paymentRecord.id,
            bookingId: booking.id,
          };
        }

        // 4. Server-Side Currency Verification: Reconcile with trusted server currency
        if (
          event.currency &&
          event.currency.toUpperCase() !== paymentRecord.currency.toUpperCase()
        ) {
          throw new ApiError(
            400,
            `Currency mismatch: expected ${paymentRecord.currency}, received ${event.currency}.`
          );
        }

        // 5. Server-Side Amount Verification: Never trust client-supplied amounts
        const expectedAmount = Number(booking.amount);
        const receivedAmount = Number(providerAmount);

        if (Math.abs(expectedAmount - receivedAmount) > 0.01) {
          throw new ApiError(
            400,
            `Amount mismatch: expected ${expectedAmount}, received ${receivedAmount}.`
          );
        }

        // 6. Handle late callback after cancellation or access window expiry according to explicit business policy
        if (
          booking.status === "CANCELLED" ||
          booking.status === "EXPIRED" ||
          booking.endTime <= new Date()
        ) {
          const refundedPayment = await tx.payment.update({
            where: { id: paymentRecord.id },
            data: {
              paymentStatus: "REFUNDED",
              transactionId,
              paidAt: new Date(),
            },
          });

          return {
            status: "BOOKING_INELIGIBLE_FOR_CONFIRMATION",
            message:
              "Payment captured for an expired or cancelled booking; flagged for refund.",
            paymentId: refundedPayment.id,
            bookingId: booking.id,
            bookingStatus: booking.status,
          };
        }

        // 7. Handle failed/canceled payment status from provider
        if (providerStatus !== "SUCCESS" && providerStatus !== "CAPTURED") {
          const failedPayment = await tx.payment.update({
            where: { id: paymentRecord.id },
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

        // 8. Successful payment confirmation & Outbox event
        const updatedPayment = await tx.payment.update({
          where: { id: paymentRecord.id },
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

/**
 * Create a real Razorpay Order for frontend client checkout.
 */
export const createRazorpayOrder = async (bookingId, userId) => {
  return prisma.$transaction(async (tx) => {
    const booking = await getCustomerBooking(tx, bookingId, userId);

    if (booking.status !== "PENDING") {
      throw new ApiError(400, "Razorpay order can only be created for pending bookings.");
    }

    if (booking.endTime <= new Date()) {
      throw new ApiError(409, "This booking's access window has expired.");
    }

    if (!booking.amount || Number(booking.amount) <= 0) {
      throw new ApiError(400, "Invalid booking amount configured for this toilet.");
    }

    if (booking.payment?.paymentStatus === "SUCCESS") {
      throw new ApiError(409, "This booking is already paid.");
    }

    const amountInPaise = Math.round(Number(booking.amount) * 100);
    const receipt = `rcpt_${booking.id.slice(-30)}`;

    // Method A: Razorpay Route split calculation
    // Platform fee percentage (default 10%, configurable via PLATFORM_FEE_PERCENT)
    const PLATFORM_FEE_PERCENT = Number(process.env.PLATFORM_FEE_PERCENT || 10);
    const platformFeeInPaise = Math.round((amountInPaise * PLATFORM_FEE_PERCENT) / 100);
    const ownerShareInPaise = amountInPaise - platformFeeInPaise;
    const ownerShare = (ownerShareInPaise / 100).toFixed(2);
    const platformFee = (platformFeeInPaise / 100).toFixed(2);

    const owner = booking.toilet.owner;
    let transfers = undefined;

    // Direct split to that particular toilet owner if onboarded to Razorpay Route
    if (owner?.razorpayAccountId) {
      transfers = [
        {
          account: owner.razorpayAccountId,
          amount: ownerShareInPaise,
          currency: "INR",
          on_hold: 1, // Funds held in escrow until restroom usage session completes!
          notes: {
            bookingId: booking.id,
            toiletId: booking.toiletId,
            ownerId: owner.id,
          },
        },
      ];
    }

    let order;
    const razorpay = getRazorpayInstance();
    const isMock = isDevelopmentMockEnabled();

    const orderPayload = {
      amount: amountInPaise,
      currency: "INR",
      receipt,
      notes: {
        bookingId: booking.id,
        userId: booking.userId,
        toiletId: booking.toiletId,
        ownerId: owner?.id,
        ownerRazorpayAccountId: owner?.razorpayAccountId || null,
      },
      ...(transfers ? { transfers } : {}),
    };

    if (razorpay && !isMock) {
      try {
        order = await razorpay.orders.create(orderPayload);
      } catch (err) {
        throw new ApiError(502, `Failed to create Razorpay Route order: ${err.message || err}`);
      }
    } else {
      // In development / test environment with mock mode enabled, generate valid Razorpay order structure
      order = {
        id: `order_${randomUUID().replace(/-/g, "").slice(0, 14)}`,
        entity: "order",
        amount: amountInPaise,
        currency: "INR",
        receipt,
        status: "created",
        transfers,
      };
    }

    // Persist orderId, ownerShare, platformFee, and transferStatus on Payment record
    const existingPayment = booking.payment;
    let paymentRecord;
    const paymentData = {
      orderId: order.id,
      amount: booking.amount,
      currency: "INR",
      paymentMethod: "UPI",
      paymentStatus: "PENDING",
      ownerShare,
      platformFee,
      transferStatus: owner?.razorpayAccountId ? "HELD" : null,
    };

    if (existingPayment) {
      paymentRecord = await tx.payment.update({
        where: { id: existingPayment.id },
        data: paymentData,
      });
    } else {
      paymentRecord = await tx.payment.create({
        data: {
          bookingId: booking.id,
          ...paymentData,
        },
      });
    }

    return {
      orderId: order.id,
      amount: Number(booking.amount),
      amountInPaise,
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID || "rzp_test_dev",
      bookingId: booking.id,
      paymentId: paymentRecord.id,
      split: {
        ownerId: owner?.id,
        ownerAccountId: owner?.razorpayAccountId || null,
        ownerShare: Number(ownerShare),
        ownerShareInPaise,
        platformFee: Number(platformFee),
        platformFeeInPaise,
        transferStatus: owner?.razorpayAccountId ? "HELD" : "DIRECT",
        onHold: Boolean(owner?.razorpayAccountId),
      },
    };
  });
};

/**
 * Verify client-side Razorpay modal completion signature.
 */
export const verifyRazorpayPayment = async ({
  bookingId,
  userId,
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
}) => {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    throw new ApiError(500, "Razorpay key secret is not configured.");
  }

  // 1. Verify Razorpay cryptographic signature: HMAC-SHA256(order_id + "|" + payment_id, secret)
  const text = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expectedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(text)
    .digest("hex");

  const sigBuffer = Buffer.from(razorpaySignature);
  const expBuffer = Buffer.from(expectedSignature);

  if (
    sigBuffer.length !== expBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expBuffer)
  ) {
    throw new ApiError(400, "Invalid Razorpay payment signature.");
  }

  return executeWithRetry(async () => {
    return prisma.$transaction(
      async (tx) => {
        // 2. Idempotency Check: Don't process twice if already succeeded
        const existingTx = await tx.payment.findFirst({
          where: { transactionId: razorpayPaymentId },
        });

        if (existingTx) {
          if (existingTx.bookingId !== bookingId) {
            throw new ApiError(
              409,
              "Razorpay payment ID is already associated with another booking."
            );
          }
          if (existingTx.paymentStatus === "SUCCESS") {
            const booking = await tx.booking.findUnique({
              where: { id: bookingId },
            });
            return {
              status: "ALREADY_PROCESSED",
              booking,
              payment: existingTx,
            };
          }
        }

        const booking = await getCustomerBooking(tx, bookingId, userId);

        if (booking.status === "CONFIRMED" && booking.payment?.paymentStatus === "SUCCESS") {
          return {
            status: "ALREADY_CONFIRMED",
            booking,
            payment: booking.payment,
          };
        }

        // 3. Late callback handling for cancelled / expired bookings
        if (
          booking.status === "CANCELLED" ||
          booking.status === "EXPIRED" ||
          booking.endTime <= new Date()
        ) {
          const refundedPayment = await tx.payment.update({
            where: { id: booking.payment.id },
            data: {
              paymentStatus: "REFUNDED",
              orderId: razorpayOrderId,
              transactionId: razorpayPaymentId,
              paidAt: new Date(),
            },
          });

          return {
            status: "BOOKING_INELIGIBLE_FOR_CONFIRMATION",
            message:
              "Payment captured for an expired or cancelled booking; flagged for refund.",
            booking,
            payment: refundedPayment,
          };
        }

        // 4. Update Payment to SUCCESS and Booking to CONFIRMED
        const updatedPayment = await tx.payment.update({
          where: { id: booking.payment.id },
          data: {
            paymentStatus: "SUCCESS",
            orderId: razorpayOrderId,
            transactionId: razorpayPaymentId,
            paidAt: new Date(),
          },
        });

        const updatedBooking = await tx.booking.update({
          where: { id: booking.id },
          data: { status: "CONFIRMED" },
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

        // 5. Emit outbox event atomically
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
          status: "SUCCESS",
          booking: updatedBooking,
          payment: updatedPayment,
        };
      },
      {
        isolationLevel: "Serializable",
      }
    );
  });
};

/**
 * Onboard or link a toilet owner to Razorpay Route for split payouts.
 */
export const linkOwnerRazorpayAccount = async (ownerId, { businessName, payoutUpiId } = {}) => {
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
  });

  if (!owner) {
    throw new ApiError(404, "User not found.");
  }

  if (owner.role !== "OWNER") {
    throw new ApiError(403, "Only toilet owners can configure a Razorpay Route payout account.");
  }

  let accountId = owner.razorpayAccountId;
  const razorpay = getRazorpayInstance();
  const isMock = isDevelopmentMockEnabled();

  if (!accountId) {
    if (razorpay && !isMock) {
      try {
        const account = await razorpay.accounts.create({
          type: "route",
          email: owner.email,
          phone: owner.phoneNumber || "9876543210",
          legal_business_name: businessName || owner.fullName,
          business_type: "individual",
          contact_name: owner.fullName,
          profile: {
            category: "services",
            subcategory: "sanitation",
          },
        });
        accountId = account.id;
      } catch (err) {
        throw new ApiError(502, `Failed to create Razorpay Route linked account: ${err.message || err}`);
      }
    } else {
      accountId = `acc_${randomUUID().replace(/-/g, "").slice(0, 14)}`;
    }
  }

  const updatedOwner = await prisma.user.update({
    where: { id: ownerId },
    data: {
      razorpayAccountId: accountId,
      businessName: businessName || owner.businessName,
      payoutUpiId: payoutUpiId || owner.payoutUpiId,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      razorpayAccountId: true,
      businessName: true,
      payoutUpiId: true,
    },
  });

  return updatedOwner;
};

/**
 * Get linked Razorpay Route account details for an owner.
 */
export const getOwnerRazorpayAccount = async (ownerId) => {
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      razorpayAccountId: true,
      businessName: true,
      payoutUpiId: true,
    },
  });

  if (!owner) {
    throw new ApiError(404, "Owner not found.");
  }

  return owner;
};

export default {
  initiatePayment,
  simulatePaymentResult,
  getPaymentStatus,
  processPayment,
  getPaymentByBookingId,
  handlePaymentWebhook,
  createRazorpayOrder,
  verifyRazorpayPayment,
  linkOwnerRazorpayAccount,
  getOwnerRazorpayAccount,
};
