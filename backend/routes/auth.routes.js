import {Router} from "express";
import authController from "../src/controllers/auth.controller.js";
import validate from "../middleware/validate.middleware.js";
import {
    registerSchema,
    loginSchema,
} from "../validations/auth.validator.js";
import authenticate from "../middleware/auth.js";
import authorize from "../middleware/authorize.middleware.js";
import ROLES from "../src/constants/roles.js";

const router = Router();

// Public route
router.post(
    "/register",
    validate(registerSchema),
    authController.register
);

router.post(
    "/login",
    validate(loginSchema),
    authController.login
);

router.post(
    "/refresh-token",
    authController.refreshToken
);

// Protected Routes

router.post(
    "/logout",
    authenticate,
    authController.logout
);

router.get(
    "/me",
    authenticate,
    authorize(ROLES.USER, ROLES.OWNER, ROLES.ADMIN),
    authController.getCurrentUser
);

export default router;