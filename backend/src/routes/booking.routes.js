import { Router } from "express";

import { createBooking } from "../controllers/booking.controller.js";
import {
  getMyBookings,
  getMyBookingById,
  cancelMyBooking,
} from "../controllers/customerBooking.controller.js";

import validate from "../middlewares/validate.middleware.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";
import { createBookingSchema } from "../validators/booking.schema.js";

const router = Router();

router.use(authenticate);
router.use(authorizeRoles("USER"));

router.post(
  "/",
  validate(createBookingSchema),
  createBooking
);

router.get("/", getMyBookings);

router.patch("/:bookingId/cancel", cancelMyBooking);

router.get("/:bookingId", getMyBookingById);

export default router;
