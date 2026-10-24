import { Router } from "express";
import {
    getUsers,
    setUserStatus,
    getToilets,
    setToiletVerification,
    getStats,
} from "../controllers/admin.controller.js";
import authenticate from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";

const router = Router();

// All admin routes require ADMIN role
router.use(authenticate);
router.use(authorizeRoles("ADMIN"));

router.get("/users", getUsers);
router.patch("/users/:userId/status", setUserStatus);

router.get("/toilets", getToilets);
router.patch("/toilets/:toiletId/verify", setToiletVerification);

router.get("/stats", getStats);

export default router;
