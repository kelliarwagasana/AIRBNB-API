import { Router } from "express";
import { createReview, deleteReview, getListingReviews } from "../controllers/review.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
/**
 * @swagger
 * components:
 *   schemas:
 *     ReviewReviewer:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           example: 7fd37a18-c918-4f09-a5f8-453b6d53a4cc
 *         name:
 *           type: string
 *           example: Alice
 *         avatar:
 *           type: string
 *           nullable: true
 *           example: https://example.com/avatar.jpg
 *
 *     Review:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         rating:
 *           type: integer
 *           example: 5
 *         comment:
 *           type: string
 *           nullable: true
 *           example: Amazing stay and great host.
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: 2026-04-29T12:00:00.000Z
 *         listingId:
 *           type: string
 *           format: uuid
 *           example: 71666a39-12e3-4639-ba21-6b76eed83155
 *         reviewerId:
 *           type: string
 *           format: uuid
 *           example: 3
 *         reviewer:
 *           $ref: '#/components/schemas/ReviewReviewer'
 *
 *     CreateReviewInput:
 *       type: object
 *       required: [rating]
 *       properties:
 *         rating:
 *           type: integer
 *           minimum: 1
 *           maximum: 5
 *           example: 5
 *         comment:
 *           type: string
 *           example: Amazing stay and great host.
 */
const router = Router();
/**
 * @swagger
 * /api/v1/listings/{id}/reviews:
 *   get:
 *     summary: Get all reviews for a listing
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The listing ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of reviews per page
 *     responses:
 *       200:
 *         description: Paginated reviews with reviewer name and avatar
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Review'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       404:
 *         description: Listing not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/listings/:id/reviews", getListingReviews);
/**
 * @swagger
 * /api/v1/listings/{id}/reviews:
 *   post:
 *     summary: Create a review for a listing
 *     description: rating must be between 1 and 5
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The listing ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateReviewInput'
 *     responses:
 *       201:
 *         description: Review created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Review'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Listing not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/listings/:id/reviews", authenticate, createReview);
/**
 * @swagger
 * /api/v1/reviews/{id}:
 *   delete:
 *     summary: Delete a review
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The review ID
 *     responses:
 *       200:
 *         description: Review deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Review deleted successfully
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Review not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete("/reviews/:id", authenticate, deleteReview);
export default router;
