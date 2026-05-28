import type { Response } from "express";
import { prisma } from "../lib/prisma.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";

function parsePagination(req: AuthRequest) {
  const page = parseInt((req.query["page"] as string) ?? "1", 10);
  const limit = parseInt((req.query["limit"] as string) ?? "20", 10);

  if (Number.isNaN(page) || page < 1 || Number.isNaN(limit) || limit < 1 || limit > 50) {
    return null;
  }

  return { page, limit, skip: (page - 1) * limit };
}

export async function getNotifications(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const pagination = parsePagination(req);
    if (!pagination) {
      return res.status(400).json({ error: "Invalid pagination parameters" });
    }

    const { page, limit, skip } = pagination;

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: req.userId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where: { userId: req.userId } }),
      prisma.notification.count({ where: { userId: req.userId, read: false } }),
    ]);

    return res.json({
      data: notifications,
      meta: {
        total,
        unreadCount,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch {
    return res.status(500).json({ error: "Something went wrong" });
  }
}

export async function getUnreadCount(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const count = await prisma.notification.count({
      where: { userId: req.userId, read: false },
    });

    return res.json({ count });
  } catch {
    return res.status(500).json({ error: "Something went wrong" });
  }
}

export async function markNotificationRead(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const id = req.params["id"] as string;
    if (!id) {
      return res.status(400).json({ error: "Invalid notification ID" });
    }

    const notification = await prisma.notification.findFirst({
      where: { id, userId: req.userId },
    });

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { read: true },
    });

    return res.json(updated);
  } catch {
    return res.status(500).json({ error: "Something went wrong" });
  }
}

export async function markAllNotificationsRead(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    await prisma.notification.updateMany({
      where: { userId: req.userId, read: false },
      data: { read: true },
    });

    return res.json({ message: "All notifications marked as read" });
  } catch {
    return res.status(500).json({ error: "Something went wrong" });
  }
}
