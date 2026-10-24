import express from "express";
import paymentController, {
    initiatePayment,
    simulatePaymentResult,
    getPaymentStatus,
} from "../src/controllers/payment.controller.js";
import authenticate from "../middleware/auth.js";
import validate from "../middleware/validate.middleware.js";
import {
    initiatePaymentSchema,
    mockPaymentResultSchema,
} from "../src/validators/payment.schema.js";

const router = express.Router();

// Phase 5.4 payment workflow endpoints
router.post(
    "/:bookingId/payment",
    authenticate,
    validate(initiatePaymentSchema),
    initiatePayment
);

router.post(
    "/:bookingId/payment/mock-result",
    authenticate,
    validate(mockPaymentResultSchema),
    simulatePaymentResult
);

router.get(
    "/:bookingId/payment",
    authenticate,
    getPaymentStatus
);

// Phase 5.1 direct payments (used by booking integration test suite)
router.post(
    "/:bookingId/payments",
    authenticate,
    paymentController.processPayment
);

router.get(
    "/:bookingId/payments",
    authenticate,
    paymentController.getPayment
);

export default router;
