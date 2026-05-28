import { Router } from "express";
import {
  getNotifications,
  getUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "../../controllers/notifications.controller.js";
import { authenticate, requireHost } from "../../middleware/auth.middleware.js";

const router = Router();

router.get("/", authenticate, requireHost, getNotifications);
router.get("/unread-count", authenticate, requireHost, getUnreadCount);
router.patch("/read-all", authenticate, requireHost, markAllNotificationsRead);
router.patch("/:id/read", authenticate, requireHost, markNotificationRead);

export default router;
