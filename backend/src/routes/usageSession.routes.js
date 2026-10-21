import { Router } from "express";

import {
  startUsageSession,
  endUsageSession,
  getUsageSessionById,
} from "../controllers/usageSession.controller.js";

import validate from "../middlewares/validate.middleware.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";

import {
  startSessionSchema,
} from "../validators/usageSession.schema.js";

const router = Router();

router.use(authenticate);
router.use(authorizeRoles("OWNER"));

router.post(
  "/start",
  validate(startSessionSchema),
  startUsageSession
);

router.patch(
  "/:sessionId/end",
  endUsageSession
);

router.get(
  "/:sessionId",
  getUsageSessionById
);

export default router;
