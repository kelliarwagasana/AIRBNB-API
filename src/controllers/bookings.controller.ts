import type { Response } from "express";
import { prisma } from "../lib/prisma.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { sendEmail } from "../config/email.js";
import { bookingCancellationEmail, bookingConfirmationEmail } from "../templates/email.js";

function parsePagination(req: AuthRequest) {
  const page = parseInt((req.query["page"] as string) ?? "1", 10);
  const limit = parseInt((req.query["limit"] as string) ?? "10", 10);

  if (Number.isNaN(page) || page < 1 || Number.isNaN(limit) || limit < 1) {
    return null;
  }

  return { page, limit, skip: (page - 1) * limit };
}

export async function getAllBookings(req: AuthRequest, res: Response) {
  try {
    const pagination = parsePagination(req);

    if (!pagination) {
      return res.status(400).json({ error: "Invalid pagination parameters" });
    }

    const { page, limit, skip } = pagination;

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        include: {
          guest: {
            select: {
              name: true,
            },
          },
          listing: {
            select: {
              title: true,
              location: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.booking.count(),
    ]);

    return res.json({
      data: bookings,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch {
    return res.status(500).json({ error: "Something went wrong" });
  }
}

export async function getBookingById(req: AuthRequest, res: Response) {
  try {
    const id = req.params["id"] as string;

    if (!id) {
      return res.status(400).json({ error: "Invalid booking ID" });
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        guest: true,
        listing: true,
      },
    });

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    return res.json(booking);
  } catch {
    return res.status(500).json({ error: "Something went wrong" });
  }
}

export async function createBooking(req: AuthRequest, res: Response) {
  try {
    const { userId, listingId, checkIn, checkOut, guests } = req.body;

    if (!listingId || !checkIn || !checkOut || !guests || (!userId && !req.userId)) {
      return res.status(400).json({ error: "userId, listingId, checkIn, checkOut and guests are required" });
    }

    const effectiveUserId = userId ?? req.userId;
    const parsedListingId = listingId;
    const parsedGuests = Number(guests);
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const now = new Date();

    if (req.userId && userId && effectiveUserId !== req.userId && req.role !== "ADMIN") {
      return res.status(403).json({ error: "You can only create bookings for your own account" });
    }

    if (
      !effectiveUserId ||
      !parsedListingId ||
      Number.isNaN(parsedGuests) ||
      Number.isNaN(checkInDate.getTime()) ||
      Number.isNaN(checkOutDate.getTime())
    ) {
      return res.status(400).json({ error: "Invalid booking payload" });
    }

    if (checkInDate >= checkOutDate) {
      return res.status(400).json({ error: "checkIn must be before checkOut" });
    }

    if (checkInDate <= now) {
      return res.status(400).json({ error: "checkIn must be in the future" });
    }

    const [user, listing] = await Promise.all([
      prisma.user.findUnique({ where: { id: effectiveUserId } }),
      prisma.listing.findUnique({ where: { id: parsedListingId } }),
    ]);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!listing) {
      return res.status(404).json({ error: "Listing not found" });
    }

    const conflictingBooking = await prisma.booking.findFirst({
      where: {
        listingId: parsedListingId,
        status: "CONFIRMED",
        checkIn: { lt: checkOutDate },
        checkOut: { gt: checkInDate },
      },
    });

    if (conflictingBooking) {
      return res.status(409).json({ error: "Booking dates conflict with an existing booking" });
    }

    const totalDays = Math.ceil(
      (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    const booking = await prisma.booking.create({
      data: {
        guestId: effectiveUserId,
        listingId: parsedListingId,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        guests: parsedGuests,
        totalPrice: totalDays * listing.pricePerNight,
        status: "PENDING",
      },
      include: {
        listing: true,
        guest: true,
      },
    });

    try {
      await sendEmail({
        to: booking.guest.email,
        subject: "Booking Confirmation",
        html: bookingConfirmationEmail(
          booking.guest.name,
          booking.listing.title,
          booking.listing.location,
          checkInDate.toDateString(),
          checkOutDate.toDateString(),
          booking.totalPrice,
        ),
      });
    } catch (error) {
      console.error("Failed to send booking email:", error);
    }

    return res.status(201).json(booking);
  } catch {
    return res.status(500).json({ error: "Something went wrong" });
  }
}

export async function updateBookingStatus(req: AuthRequest, res: Response) {
  try {
    const id = req.params["id"] as string;
    const { status } = req.body;

    if (!id) {
      return res.status(400).json({ error: "Invalid booking ID" });
    }

    if (!status) {
      return res.status(400).json({ error: "status is required" });
    }

    const validStatuses = ["PENDING", "CONFIRMED", "CANCELLED"];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status. Must be PENDING, CONFIRMED, or CANCELLED" });
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
    });

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: { status },
    });

    return res.json(updatedBooking);
  } catch {
    return res.status(500).json({ error: "Something went wrong" });
  }
}

export async function deleteBooking(req: AuthRequest, res: Response) {
  try {
    const id = req.params["id"] as string;

    if (!id) {
      return res.status(400).json({ error: "Invalid booking ID" });
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        guest: true,
        listing: true,
      },
    });

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    if (req.userId && booking.guestId !== req.userId && req.role !== "ADMIN") {
      return res.status(403).json({ error: "You can only cancel your own bookings" });
    }

    const cancelledBooking = await prisma.booking.update({
      where: { id },
      data: {
        status: "CANCELLED",
      },
      include: {
        guest: true,
        listing: true,
      },
    });

    try {
      await sendEmail({
        to: cancelledBooking.guest.email,
        subject: "Booking Cancelled",
        html: bookingCancellationEmail(
          cancelledBooking.guest.name,
          cancelledBooking.listing.title,
          cancelledBooking.checkIn.toDateString(),
          cancelledBooking.checkOut.toDateString(),
        ),
      });
    } catch (error) {
      console.error("Failed to send cancellation email:", error);
    }

    return res.json({ message: "Booking cancelled successfully" });
  } catch {
    return res.status(500).json({ error: "Something went wrong" });
  }
}
