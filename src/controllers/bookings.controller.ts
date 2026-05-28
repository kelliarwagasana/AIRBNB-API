import type { Response } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { sendEmail } from "../config/email.js";
import { bookingCancellationEmail, bookingConfirmationEmail } from "../templates/email.js";
import {
  notifyAdmins,
  notifyUserUnlessSelf,
} from "../services/notification.service.js";

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
    const where: Prisma.BookingWhereInput = {};
    const status = String(req.query["status"] ?? "").toUpperCase();
    const dateFrom = req.query["dateFrom"] ? new Date(String(req.query["dateFrom"])) : null;
    const dateTo = req.query["dateTo"] ? new Date(String(req.query["dateTo"])) : null;

    if (["PENDING", "CONFIRMED", "CANCELLED"].includes(status)) {
      where.status = status as Prisma.EnumBookingStatusFilter["equals"];
    }

    if (dateFrom && !Number.isNaN(dateFrom.getTime())) {
      where.checkIn = { ...(typeof where.checkIn === "object" ? where.checkIn : {}), gte: dateFrom };
    }

    if (dateTo && !Number.isNaN(dateTo.getTime())) {
      where.checkOut = { ...(typeof where.checkOut === "object" ? where.checkOut : {}), lte: dateTo };
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
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
      prisma.booking.count({ where }),
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

export async function getMyBookings(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const bookings = await prisma.booking.findMany({
      where: {
        guestId: req.userId,
        status: { not: "CANCELLED" },
      },
      include: {
        guest: true,
        listing: {
          include: {
            photos: true,
            host: {
              select: {
                id: true,
                name: true,
                email: true,
                username: true,
                phone: true,
                role: true,
                avatar: true,
                createdAt: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json(bookings);
  } catch {
    return res.status(500).json({ error: "Something went wrong" });
  }
}

export async function getHostBookings(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const bookings = await prisma.booking.findMany({
      where: {
        listing: { hostId: req.userId },
      },
      include: {
        guest: true,
        listing: {
          include: {
            photos: true,
            host: {
              select: {
                id: true,
                name: true,
                email: true,
                username: true,
                phone: true,
                role: true,
                avatar: true,
                createdAt: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json(bookings);
  } catch {
    return res.status(500).json({ error: "Something went wrong" });
  }
}

export async function createBooking(req: AuthRequest, res: Response) {
  try {
    const { listingId, checkIn, checkOut, guests } = req.body;

    if (!listingId || !checkIn || !checkOut || guests === undefined || guests === null) {
      return res.status(400).json({ error: "listingId, checkIn, checkOut and guests are required" });
    }

    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const effectiveUserId = req.userId;
    const parsedListingId = listingId;
    const parsedGuests = Number(guests);
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const now = new Date();

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
    const totalDays = Math.ceil(
      (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    const totalPrice = totalDays * listing.pricePerNight;

    try {
      const booking = await prisma.$transaction(async (tx) => {
        // Check for date conflicts inside the transaction
        const conflict = await tx.booking.findFirst({
          where: {
            listingId: parsedListingId,
            status: "CONFIRMED",
            checkIn: { lt: checkOutDate },
            checkOut: { gt: checkInDate },
          },
        });

        if (conflict) {
          throw new Error("BOOKING_CONFLICT");
        }

        return tx.booking.create({
          data: { listingId: parsedListingId, guestId: effectiveUserId, checkIn: checkInDate, checkOut: checkOutDate, guests: parsedGuests, totalPrice, status: "PENDING" },
          include: {
            listing: true,
            guest: true,
          },
        });
      });

      try {
        await sendEmail(
          booking.guest.email,
          "Booking Confirmation",
          bookingConfirmationEmail(
            booking.guest.name,
            booking.listing.title,
            booking.listing.location,
            checkInDate.toDateString(),
            checkOutDate.toDateString(),
            booking.totalPrice,
          ),
        );
      } catch (error) {
        console.error("Failed to send booking email:", error);
      }

      try {
        const bookingMeta = {
          bookingId: booking.id,
          listingId: booking.listingId,
          guestName: booking.guest.name,
        };

        await notifyUserUnlessSelf(booking.listing.hostId, effectiveUserId, {
          type: "BOOKING_CREATED",
          title: "New booking request",
          body: `${booking.guest.name} requested to book "${booking.listing.title}".`,
          metadata: bookingMeta,
        });

        await notifyAdmins({
          type: "BOOKING_CREATED",
          title: "New platform booking",
          body: `${booking.guest.name} booked "${booking.listing.title}".`,
          metadata: bookingMeta,
        });
      } catch (error) {
        console.error("Failed to create booking notifications:", error);
      }

      return res.status(201).json(booking);
    } catch (error) {
      if (error instanceof Error && error.message === "BOOKING_CONFLICT") {
        return res.status(409).json({ error: "Booking dates conflict with an existing booking" });
      }
      throw error;
    }
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
      include: { listing: true },
    });

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const isListingHost = booking.listing.hostId === req.userId;
    const isAdmin = req.role === "ADMIN";

    if (!isListingHost && !isAdmin) {
      return res.status(403).json({ error: "Only the listing host can update this booking" });
    }

    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: { status },
      include: {
        guest: true,
        listing: {
          include: {
            photos: true,
            host: true,
          },
        },
      },
    });

    try {
      const bookingMeta = {
        bookingId: updatedBooking.id,
        listingId: updatedBooking.listingId,
        listingTitle: updatedBooking.listing.title,
      };

      if (status === "CONFIRMED") {
        await notifyUserUnlessSelf(updatedBooking.guestId, req.userId, {
          type: "BOOKING_CONFIRMED",
          title: "Booking confirmed",
          body: `Your booking for "${updatedBooking.listing.title}" has been confirmed.`,
          metadata: bookingMeta,
        });
      } else if (status === "CANCELLED") {
        await notifyUserUnlessSelf(updatedBooking.guestId, req.userId, {
          type: "BOOKING_DECLINED",
          title: "Booking declined",
          body: `Your booking request for "${updatedBooking.listing.title}" was declined.`,
          metadata: bookingMeta,
        });
      }
    } catch (error) {
      console.error("Failed to create booking status notifications:", error);
    }

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
      await sendEmail(
        cancelledBooking.guest.email,
        "Booking Cancelled",
        bookingCancellationEmail(
          cancelledBooking.guest.name,
          cancelledBooking.listing.title,
          cancelledBooking.checkIn.toDateString(),
          cancelledBooking.checkOut.toDateString(),
        ),
      );
    } catch (error) {
      console.error("Failed to send cancellation email:", error);
    }

    try {
      if (cancelledBooking.guestId === req.userId) {
        await notifyUserUnlessSelf(cancelledBooking.listing.hostId, req.userId, {
          type: "BOOKING_CANCELLED",
          title: "Booking cancelled",
          body: `${cancelledBooking.guest.name} cancelled their booking for "${cancelledBooking.listing.title}".`,
          metadata: {
            bookingId: cancelledBooking.id,
            listingId: cancelledBooking.listingId,
            guestName: cancelledBooking.guest.name,
          },
        });
      }
    } catch (error) {
      console.error("Failed to create cancellation notifications:", error);
    }

    return res.json({ message: "Booking cancelled successfully" });
  } catch {
    return res.status(500).json({ error: "Something went wrong" });
  }
}
