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
} from "../validators/payment.schema.js";

const router = Router();

router.use(authenticate);
router.use(authorizeRoles("USER"));

// Phase 5.4 payment workflow endpoints
router.post(
  "/:bookingId/payment",
  validate(initiatePaymentSchema),
  initiatePayment
);

router.post(
  "/:bookingId/payment/mock-result",
  validate(mockPaymentResultSchema),
  simulatePaymentResult
);

router.post(
  "/:bookingId/payments/mock-result",
  validate(mockPaymentResultSchema),
  simulatePaymentResult
);

router.get(
  "/:bookingId/payment",
  getPaymentStatus
);

// Backward-compatibility legacy endpoint for Phase 5.1 direct tests
router.post(
  "/:bookingId/payments",
  paymentController.processPayment
);

router.get(
  "/:bookingId/payments",
  paymentController.getPayment
);

export default router;
