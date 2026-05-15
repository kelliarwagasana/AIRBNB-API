import { Router } from "express";
import { banUser, getAdminStats } from "../../controllers/admin.controller.js";
import { authenticate, requireAdmin } from "../../middleware/auth.middleware.js";

const router = Router();

router.get("/stats", authenticate, requireAdmin, getAdminStats);
router.post("/users/:userId/ban", authenticate, requireAdmin, banUser);

export default router;
