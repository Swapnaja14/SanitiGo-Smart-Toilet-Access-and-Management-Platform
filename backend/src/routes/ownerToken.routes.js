import { Router } from "express";

import {
  verifyOwnerBookingToken,
} from "../controllers/ownerToken.controller.js";

import validate from "../middlewares/validate.middleware.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";

import {
  verifyBookingTokenSchema,
} from "../validators/ownerToken.schema.js";

const router = Router();

router.post(
  "/verify-token",
  authenticate,
  authorizeRoles("OWNER"),
  validate(verifyBookingTokenSchema),
  verifyOwnerBookingToken
);

export default router;
