import { Router } from "express";
import {
  createBooking,
  deleteBooking,
  getAllBookings,
  getBookingById,
  updateBookingStatus,
} from "../controllers/bookings.controller.js";
import { authenticate, requireGuest } from "../middleware/auth.middleware.js";

/**
 * @swagger
 * components:
 *   schemas:
 *     BookingGuest:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           example: 7fd37a18-c918-4f09-a5f8-453b6d53a4cc
 *         name:
 *           type: string
 *           example: Alice
 *         email:
 *           type: string
 *           format: email
 *           example: alice@example.com
 *         username:
 *           type: string
 *           example: alice123
 *         role:
 *           type: string
 *           enum: [GUEST, HOST, ADMIN]
 *           example: GUEST
 *
 *     BookingListing:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           example: 71666a39-12e3-4639-ba21-6b76eed83155
 *         title:
 *           type: string
 *           example: Sea View Apartment
 *         location:
 *           type: string
 *           example: Cape Town
 *         pricePerNight:
 *           type: number
 *           example: 1500
 *
 *     Booking:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           example: b1d0f73f-251d-43b0-8ed8-28ef1f88f2f1
 *         guestId:
 *           type: string
 *           format: uuid
 *           example: 7fd37a18-c918-4f09-a5f8-453b6d53a4cc
 *         listingId:
 *           type: string
 *           format: uuid
 *           example: 71666a39-12e3-4639-ba21-6b76eed83155
 *         checkIn:
 *           type: string
 *           format: date-time
 *           example: 2026-05-10T00:00:00.000Z
 *         checkOut:
 *           type: string
 *           format: date-time
 *           example: 2026-05-15T00:00:00.000Z
 *         totalPrice:
 *           type: number
 *           example: 7500
 *         status:
 *           type: string
 *           enum: [PENDING, CONFIRMED, CANCELLED]
 *           example: PENDING
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: 2026-04-29T10:30:00.000Z
 *         guest:
 *           $ref: '#/components/schemas/BookingGuest'
 *         listing:
 *           $ref: '#/components/schemas/BookingListing'
 *
 *     CreateBookingInput:
 *       type: object
 *       required: [listingId, checkIn, checkOut]
 *       properties:
 *         listingId:
 *           type: string
 *           format: uuid
 *           example: 71666a39-12e3-4639-ba21-6b76eed83155
 *         checkIn:
 *           type: string
 *           format: date-time
 *           example: 2026-05-10T00:00:00.000Z
 *         checkOut:
 *           type: string
 *           format: date-time
 *           example: 2026-05-15T00:00:00.000Z
 */
const router = Router();

/**
 * @swagger
 * /api/v1/bookings:
 *   get:
 *     summary: Get all bookings
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *         description: Number of bookings per page
 *     responses:
 *       200:
 *         description: Paginated bookings with user and listing
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Booking'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/", authenticate, getAllBookings);

/**
 * @swagger
 * /api/v1/bookings/{id}:
 *   get:
 *     summary: Get a booking by ID
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The booking ID
 *     responses:
 *       200:
 *         description: Booking with user and listing
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Booking'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Booking not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/:id", authenticate, getBookingById);

/**
 * @swagger
 * /api/v1/bookings:
 *   post:
 *     summary: Create a booking
 *     description: total is auto-calculated from pricePerNight x nights
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateBookingInput'
 *     responses:
 *       201:
 *         description: Booking created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Booking'
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
router.post("/", authenticate, requireGuest, createBooking);

router.patch("/:id/status", updateBookingStatus);

/**
 * @swagger
 * /api/v1/bookings/{id}:
 *   delete:
 *     summary: Cancel a booking
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The booking ID
 *     responses:
 *       200:
 *         description: Booking cancelled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Booking cancelled successfully
 *                 booking:
 *                   $ref: '#/components/schemas/Booking'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Booking not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete("/:id", authenticate, deleteBooking);

export default router;
