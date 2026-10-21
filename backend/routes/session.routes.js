import express from "express";
import sessionController from "../src/controllers/session.controller.js";
import authenticate from "../middleware/auth.js";
import authorize from "../middleware/authorize.middleware.js";
import validate from "../middleware/validate.middleware.js";
import { verifyTokenSchema } from "../validations/session.validation.js";

const router = express.Router();

router.post(
    "/verify-token",
    authenticate,
    authorize("OWNER"),
    validate(verifyTokenSchema),
    sessionController.verifyTokenAndStartSession
);

router.patch(
    "/:sessionId/end",
    authenticate,
    authorize("OWNER"),
    sessionController.endSession
);

export default router;
