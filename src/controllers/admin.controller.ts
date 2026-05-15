import type { Response } from "express";
import { prisma } from "../lib/prisma.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";

export async function getAdminStats(_req: unknown, res: Response) {
  try {
    const [totalUsers, totalListings, pendingListings, approvedListings, rejectedListings, bookings] = await Promise.all([
      prisma.user.count(),
      prisma.listing.count(),
      prisma.listing.count({ where: { status: "PENDING_APPROVAL" } }),
      prisma.listing.count({ where: { status: "PUBLISHED" } }),
      prisma.listing.count({ where: { status: "REJECTED" } }),
      prisma.booking.findMany({
        select: { totalPrice: true, status: true },
      }),
    ]);

    const totalBookings = bookings.length;
    const totalRevenue = bookings
      .filter((b) => b.status === "CONFIRMED")
      .reduce((sum, b) => sum + b.totalPrice, 0);

    return res.json({
      totalUsers,
      totalListings,
      pendingListings,
      approvedListings,
      rejectedListings,
      totalBookings,
      totalRevenue,
    });
  } catch {
    return res.status(500).json({ error: "Something went wrong" });
  }
}

export async function banUser(req: AuthRequest, res: Response) {
  try {
    const userId = req.params["userId"] as string | undefined;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    if (userId === req.userId) {
      return res.status(400).json({ error: "Admins cannot ban their own account" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.role === "ADMIN") {
      return res.status(403).json({ error: "Admin accounts cannot be banned" });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        phone: true,
        role: true,
        avatar: true,
        isActive: true,
        createdAt: true,
      },
    });

    await prisma.booking.updateMany({
      where: {
        OR: [{ guestId: userId }, { listing: { hostId: userId } }],
        status: { not: "CANCELLED" },
      },
      data: { status: "CANCELLED" },
    });

    return res.json({ user: updatedUser });
  } catch {
    return res.status(500).json({ error: "Something went wrong" });
  }
}
