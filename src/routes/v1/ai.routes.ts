import { Router } from "express";
import {
  searchListingsWithAI,
  generateListingDescription,
  chatWithAi,
  recommendListings,
  getListingReviewSummary,
} from "../../controllers/ai.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";


const router = Router();
/**
 * @swagger
 * /api/v1/ai/search:
 *  post:
 *    summary: Search listings using natural language
 *    description: Convert a natural language search query into listing filters and return matching results.
 *    tags: [AI]
 *    requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            required: [query]
 *            properties:
 *              query:
 *                type: string
 *                example: "cozy apartment in New York for 2 people under $150"
 *    responses:
 *      200:
 *        description: Successful search results
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                filters:
 *                  type: object
 *                data:
 *                  type: array
 *                  items:
 *                    $ref: '#/components/schemas/Listing'
 *                meta:
 *                  type: object
 *                  properties:
 *                    total:
 *                      type: integer
 *                    page:
 *                      type: integer
 *                    limit:
 *                      type: integer
 *                    totalPages:
 *                      type: integer
 */

router.post("/search", searchListingsWithAI);

/**
 * @swagger
 * /api/v1/ai/listings/{id}/generate-description:
 *   post:
 *     summary: Generate or refresh an existing listing description using AI
 *     description: Uses a server-side listing record to generate a polished description for the requested listing.
 *     tags: [AI]
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
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tone:
 *                 type: string
 *                 enum: [professional, casual, luxury]
 *                 example: professional
 *             description: Optional tone for the generated description
 *     responses:
 *       200:
 *         description: Generated listing description
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 description:
 *                   type: string
 *                   example: "A luxury beachfront villa with stunning ocean views, modern amenities, and space for up to 6 guests. Perfect for a relaxing vacation by the sea."
 *                 listing:
 *                   $ref: '#/components/schemas/Listing'
 */
router.post("/listings/:id/generate-description", authenticate, generateListingDescription);

/**
 * @swagger
 * /api/v1/ai/chat:
 *   post:
 *     summary: Chat with the Airbnb AI assistant
 *     description: Send a question or message and receive an AI-generated reply. Optionally include a listing ID for listing-specific context.
 *     tags: [AI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message, sessionId]
 *             properties:
 *               sessionId:
 *                 type: string
 *                 example: "user-123-session-abc"
 *               message:
 *                 type: string
 *                 example: "What listings do you have in Miami?"
 *               listingId:
 *                 type: string
 *                 nullable: true
 *                 example: "71666a39-12e3-4639-ba21-6b76eed83155"
 *     responses:
 *       200:
 *         description: AI response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 response:
 *                   type: string
 *                 sessionId:
 *                   type: string
 *                 messageCount:
 *                   type: integer
 */
router.post("/chat", chatWithAi);
/**
 * @swagger
 * /api/v1/ai/recommend:
 *   post:
 *     summary: Recommend listings based on user booking history
 *     description: Uses the authenticated user's recent booking history to generate personalized recommendation filters.
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: AI-generated listing recommendations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 preferences:
 *                   type: string
 *                 searchFilters:
 *                   type: object
 *                   properties:
 *                     location:
 *                       type: string
 *                       nullable: true
 *                     type:
 *                       type: string
 *                       nullable: true
 *                     maxPrice:
 *                       type: number
 *                       nullable: true
 *                     guests:
 *                       type: integer
 *                       nullable: true
 *                 reason:
 *                   type: string
 */
router.post("/recommend", authenticate, recommendListings);
/**
 * @swagger
 * /api/v1/ai/listings/{id}/review-summary:
 *   get:
 *     summary: Get AI-powered summary of listing reviews
 *     description: Returns a short summary of reviews for a given listing, generated by AI.
 *     tags: [AI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Listing UUID
 *     responses:
 *       200:
 *         description: Listing review summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 summary:
 *                   type: string
 */
router.get("/listings/:id/review-summary", getListingReviewSummary);

export default router;
