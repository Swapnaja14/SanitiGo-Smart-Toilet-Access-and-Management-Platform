import express from "express";
import bookingController, {
    createBooking,
    getMyBookings,
    getBookingById,
    cancelBooking,
} from "../src/controllers/booking.controller.js";
import authenticate from "../middleware/auth.js";
import authorize from "../middleware/role.middleware.js";
import validate from "../middleware/validate.middleware.js";
import validateQuery from "../middleware/validateQuery.middleware.js";
import {
    createBookingSchema,
    getMyBookingQuerySchema,
} from "../validations/booking.validation.js";

const router = express.Router();

router.post(
    "/",
    authenticate,
    authorize("USER"),
    validate(createBookingSchema),
    createBooking
);

router.get(
    "/",
    authenticate,
    validateQuery(getMyBookingQuerySchema),
    bookingController.getMyBookings
);

router.get(
    "/:bookingId",
    authenticate,
    bookingController.getBookingById
);

router.patch(
    "/:bookingId/cancel",
    authenticate,
    bookingController.cancelBooking
);

export default router;
