import { Router } from "express";

import paymentController, {
  initiatePayment,
  simulatePaymentResult,
  getPaymentStatus,
} from "../controllers/payment.controller.js";

import validate from "../middlewares/validate.middleware.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";

import {
  initiatePaymentSchema,
  mockPaymentResultSchema,
  paymentWebhookSchema,
  verifyRazorpayPaymentSchema,
} from "../validators/payment.schema.js";
import ApiError from "../utils/ApiError.js";

const router = Router();

// Guard middleware to ensure mock endpoints cannot be accessed in production
const requireMockPaymentAllowed = (req, res, next) => {
  if (process.env.NODE_ENV === "production" || process.env.PAYMENT_MODE !== "mock") {
    throw new ApiError(403, "Mock payment operations are strictly disabled in production.");
  }
  next();
};

// Public payment provider webhook endpoint (authenticated via HMAC signature, not user JWT)
router.post(
  "/webhook",
  validate(paymentWebhookSchema),
  paymentController.handleWebhook
);

// Owner Razorpay Route Payout Account Setup
router.post(
  "/owner/payout-account",
  authenticate,
  authorizeRoles("OWNER"),
  paymentController.linkOwnerPayoutAccount
);

router.get(
  "/owner/payout-account",
  authenticate,
  authorizeRoles("OWNER"),
  paymentController.getOwnerPayoutAccount
);

router.use(authenticate);
router.use(authorizeRoles("USER"));

// Phase 5.4 payment workflow endpoints
router.post(
  "/:bookingId/payment",
  validate(initiatePaymentSchema),
  initiatePayment
);

// Real Razorpay gateway endpoints
router.post(
  "/:bookingId/payment/razorpay-order",
  paymentController.createRazorpayOrder
);

router.post(
  "/:bookingId/payment/razorpay-verify",
  validate(verifyRazorpayPaymentSchema),
  paymentController.verifyRazorpayPayment
);

router.post(
  "/:bookingId/payment/mock-result",
  requireMockPaymentAllowed,
  validate(mockPaymentResultSchema),
  simulatePaymentResult
);

router.post(
  "/:bookingId/payments/mock-result",
  requireMockPaymentAllowed,
  validate(mockPaymentResultSchema),
  simulatePaymentResult
);

router.get(
  "/:bookingId/payment",
  getPaymentStatus
);

// Backward-compatibility legacy endpoint for Phase 5.1 direct tests (only allowed in dev/test)
router.post(
  "/:bookingId/payments",
  requireMockPaymentAllowed,
  paymentController.processPayment
);

router.get(
  "/:bookingId/payments",
  paymentController.getPayment
);

export default router;
