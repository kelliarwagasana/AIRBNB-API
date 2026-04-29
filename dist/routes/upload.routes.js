import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { upload, handleMulterError } from "../config/multer.js";
import { uploadAvatar, deleteAvatar, uploadListingPhotos, deleteListingPhoto, } from "../controllers/upload.controller.js";
const router = Router();
// User avatar routes
router.post("/users/:id/avatar", authenticate, upload.single("avatar"), handleMulterError, uploadAvatar);
router.delete("/users/:id/avatar", authenticate, deleteAvatar);
// Listing photo routes
router.post("/listings/:id/photos", authenticate, upload.array("photos", 5), handleMulterError, uploadListingPhotos);
router.delete("/listings/:id/photos/:photoId", authenticate, deleteListingPhoto);
export default router;
