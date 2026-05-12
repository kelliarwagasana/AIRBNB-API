import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { upload, handleMulterError } from "../../config/multer.js";
import {
  uploadAvatar,
  deleteAvatar,
  uploadListingPhotos,
  deleteListingPhoto,
} from "../../controllers/upload.controller.js";

const router = Router();

// User avatar routes
/**
 * @swagger
 * /api/v1/upload/users/{id}/avatar:
 *   post:
 *     tags: [Upload]
 *     summary: Upload or replace user avatar
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User UUID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [avatar]
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Avatar uploaded successfully
 *       400:
 *         description: Invalid upload request
 *       401:
 *         description: Unauthorized
 */
router.post("/users/:id/avatar", authenticate, upload.single("avatar"), handleMulterError, uploadAvatar);
/**
 * @swagger
 * /api/v1/upload/users/{id}/avatar:
 *   delete:
 *     tags: [Upload]
 *     summary: Delete user avatar
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User UUID
 *     responses:
 *       200:
 *         description: Avatar deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Avatar not found
 */
router.delete("/users/:id/avatar", authenticate, deleteAvatar);

// Listing photo routes
/**
 * @swagger
 * /api/v1/upload/listings/{id}/photos:
 *   post:
 *     tags: [Upload]
 *     summary: Upload listing photos
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Listing UUID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [photos]
 *             properties:
 *               photos:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Listing photos uploaded successfully
 *       400:
 *         description: Invalid upload request
 *       401:
 *         description: Unauthorized
 */
router.post("/listings/:id/photos", authenticate, upload.array("photos", 5), handleMulterError, uploadListingPhotos);
/**
 * @swagger
 * /api/v1/upload/listings/{id}/photos/{photoId}:
 *   delete:
 *     tags: [Upload]
 *     summary: Delete one listing photo
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Listing UUID
 *       - in: path
 *         name: photoId
 *         required: true
 *         schema:
 *           type: string
 *         description: Photo identifier
 *     responses:
 *       200:
 *         description: Photo deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Photo not found
 */
router.delete("/listings/:id/photos/:photoId", authenticate, deleteListingPhoto);

export default router;