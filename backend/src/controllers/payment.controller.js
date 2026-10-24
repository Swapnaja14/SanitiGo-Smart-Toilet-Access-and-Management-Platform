import {
  initiatePayment as initiatePaymentService,
  simulatePaymentResult as simulatePaymentResultService,
  getPaymentStatus as getPaymentStatusService,
  processPayment as processPaymentService,
  handlePaymentWebhook as handlePaymentWebhookService,
  createRazorpayOrder as createRazorpayOrderService,
  verifyRazorpayPayment as verifyRazorpayPaymentService,
  linkOwnerRazorpayAccount as linkOwnerRazorpayAccountService,
  getOwnerRazorpayAccount as getOwnerRazorpayAccountService,
} from "../services/payment.service.js";

import ApiError from "../utils/ApiError.js";

export const initiatePayment = async (req, res, next) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      throw new ApiError(401, "Authentication is required.");
    }

    const payment = await initiatePaymentService(
      req.params.bookingId,
      userId,
      req.body.paymentMethod
    );

    return res.status(201).json({
      success: true,
      message: "Payment initiated successfully.",
      data: payment,
    });
  } catch (error) {
    next(error);
  }
};

export const simulatePaymentResult = async (
  req,
  res,
  next
) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      throw new ApiError(401, "Authentication is required.");
    }

    const result = await simulatePaymentResultService(
      req.params.bookingId,
      userId,
      req.body.outcome
    );

    return res.status(200).json({
      success: true,
      message:
        result.payment.paymentStatus === "SUCCESS"
          ? "Mock payment successful."
          : "Mock payment failed.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getPaymentStatus = async (req, res, next) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      throw new ApiError(401, "Authentication is required.");
    }

    const payment = await getPaymentStatusService(
      req.params.bookingId,
      userId
    );

    return res.status(200).json({
      success: true,
      message: "Payment status retrieved successfully.",
      data: payment,
    });
  } catch (error) {
    next(error);
  }
};

// Backward-compatibility handlers for existing Phase 5.1 direct tests
export const processPayment = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(401, "Authentication is required.");
    }

    const result = await processPaymentService(
      userId,
      req.params.bookingId,
      req.body.paymentMethod
    );

    return res.status(200).json({
      success: true,
      message: "Payment successful",
      data: {
        booking: {
          id: result.booking.id,
          token: result.booking.token,
          status: result.booking.status,
          scheduledDate: result.booking.scheduledDate,
          startTime: result.booking.startTime,
          endTime: result.booking.endTime,
          toilet: result.booking.toilet,
        },
        payment: {
          id: result.payment.id,
          amount: result.payment.amount,
          currency: result.payment.currency,
          paymentMethod: result.payment.paymentMethod,
          paymentStatus: result.payment.paymentStatus,
          transactionId: result.payment.transactionId,
          paidAt: result.payment.paidAt,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getPayment = getPaymentStatus;

export const handleWebhook = async (req, res, next) => {
  try {
    const signature =
      req.headers["x-razorpay-signature"] ||
      req.headers["stripe-signature"] ||
      req.headers["x-payment-signature"];

    const result = await handlePaymentWebhookService({
      rawBody: req.rawBody || req.body,
      signature,
      event: req.body,
    });

    return res.status(200).json({
      success: true,
      message: "Webhook processed successfully.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const createRazorpayOrder = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(401, "Authentication is required.");
    }

    const orderData = await createRazorpayOrderService(
      req.params.bookingId,
      userId
    );

    return res.status(201).json({
      success: true,
      message: "Razorpay order created successfully.",
      data: orderData,
    });
  } catch (error) {
    next(error);
  }
};

export const verifyRazorpayPayment = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new ApiError(401, "Authentication is required.");
    }

    const result = await verifyRazorpayPaymentService({
      bookingId: req.params.bookingId,
      userId,
      razorpayOrderId: req.body.razorpayOrderId,
      razorpayPaymentId: req.body.razorpayPaymentId,
      razorpaySignature: req.body.razorpaySignature,
    });

    return res.status(200).json({
      success: true,
      message: "Razorpay payment verified and booking confirmed successfully.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const linkOwnerPayoutAccount = async (req, res, next) => {
  try {
    const ownerId = req.user?.id;
    if (!ownerId) {
      throw new ApiError(401, "Authentication is required.");
    }

    const updatedOwner = await linkOwnerRazorpayAccountService(ownerId, req.body);

    return res.status(200).json({
      success: true,
      message: "Owner Razorpay Route payout account linked successfully.",
      data: updatedOwner,
    });
  } catch (error) {
    next(error);
  }
};

export const getOwnerPayoutAccount = async (req, res, next) => {
  try {
    const ownerId = req.user?.id;
    if (!ownerId) {
      throw new ApiError(401, "Authentication is required.");
    }

    const ownerData = await getOwnerRazorpayAccountService(ownerId);

    return res.status(200).json({
      success: true,
      message: "Owner payout account retrieved successfully.",
      data: ownerData,
    });
  } catch (error) {
    next(error);
  }
};

export default {
  initiatePayment,
  simulatePaymentResult,
  getPaymentStatus,
  processPayment,
  getPayment,
  handleWebhook,
  createRazorpayOrder,
  verifyRazorpayPayment,
  linkOwnerPayoutAccount,
  getOwnerPayoutAccount,
};
