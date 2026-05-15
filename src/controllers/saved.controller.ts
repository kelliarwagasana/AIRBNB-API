import type { Response } from "express";
import { prisma } from "../lib/prisma.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";

async function listingIdsForUser(userId: string) {
  const rows = await prisma.savedListing.findMany({
    where: { userId },
    select: { listingId: true },
  });
  return { listingIds: rows.map((r) => r.listingId) };
}

export async function getSavedListings(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    return res.json(await listingIdsForUser(req.userId));
  } catch {
    return res.status(500).json({ error: "Something went wrong" });
  }
}

export async function toggleSavedListing(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const listingId = req.params["listingId"] as string;
    if (!listingId) {
      return res.status(400).json({ error: "listingId is required" });
    }

    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) {
      return res.status(404).json({ error: "Listing not found" });
    }

    const composite = { userId_listingId: { userId: req.userId, listingId } };

    const existing = await prisma.savedListing.findUnique({
      where: composite,
    });

    if (existing) {
      await prisma.savedListing.delete({ where: composite });
    } else {
      await prisma.savedListing.create({
        data: { userId: req.userId, listingId },
      });
    }

    return res.json(await listingIdsForUser(req.userId));
  } catch {
    return res.status(500).json({ error: "Something went wrong" });
  }
}
