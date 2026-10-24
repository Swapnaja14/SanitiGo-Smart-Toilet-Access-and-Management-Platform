import { Router } from "express";

import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "../controllers/notification.controller.js";

import authenticate from "../middlewares/auth.middleware.js";

const router = Router();

// All notification endpoints require authentication.
router.use(authenticate);

router.get("/unread-count", getUnreadNotificationCount);
router.get("/", getNotifications);
router.patch("/read-all", markAllNotificationsRead);
router.patch("/:notificationId/read", markNotificationRead);

export default router;
