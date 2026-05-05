import { Prisma } from "@prisma/client";
import type { ListingType } from "@prisma/client";
import type { Response } from "express";
import { clearCacheByPrefix, getCache, setCache } from "../config/cache.js";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";

function parsePagination(req: AuthRequest) {
  const page = parseInt((req.query["page"] as string) ?? "1", 10);
  const limit = parseInt((req.query["limit"] as string) ?? "10", 10);

  if (Number.isNaN(page) || page < 1 || Number.isNaN(limit) || limit < 1) {
    return null;
  }

  return { page, limit, skip: (page - 1) * limit };
}

function buildListingWhere(req: AuthRequest): Prisma.ListingWhereInput {
  const { location, type, minPrice, maxPrice, guests } = req.query;
  const where: Prisma.ListingWhereInput = {};

  if (location) {
    where.location = {
      contains: String(location),
      mode: "insensitive",
    };
  }

  if (type) {
    where.type = String(type).toUpperCase() as ListingType;
  }

  if (minPrice || maxPrice) {
    where.pricePerNight = {
      ...(minPrice && !Number.isNaN(Number(minPrice)) ? { gte: Number(minPrice) } : {}),
      ...(maxPrice && !Number.isNaN(Number(maxPrice)) ? { lte: Number(maxPrice) } : {}),
    };
  }

  if (guests && !Number.isNaN(Number(guests))) {
    where.guests = {
      gte: Number(guests),
    };
  }

  return where;
}

function invalidateListingCaches() {
  clearCacheByPrefix("listings:list:");
}

export async function getAllListings(req: AuthRequest, res: Response) {
  try {
    const pagination = parsePagination(req);

    if (!pagination) {
      return res.status(400).json({ error: "Invalid pagination parameters" });
    }

    const { page, limit, skip } = pagination;
    const cacheKey = `listings:list:${JSON.stringify(req.query)}`;
    const cached = getCache(cacheKey);

    if (cached) {
      return res.json(cached);
    }

    const where = buildListingWhere(req);

    const [listings, total] = await Promise.all([
      prisma.listing.findMany({
        where,
        include: {
          host: {
            select: {
              id: true,
              name: true,
              avatar: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.listing.count({ where }),
    ]);

    const payload = {
      data: listings,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    setCache(cacheKey, payload, 60);

    return res.json(payload);
  } catch (error) {
    logger.error("Error in getAllListings", { error, path: req.path });
    return res.status(500).json({ error: "Something went wrong" });
  }
}

export async function searchListings(req: AuthRequest, res: Response) {
  try {
    const pagination = parsePagination(req);

    if (!pagination) {
      return res.status(400).json({ error: "Invalid pagination parameters" });
    }

    const { page, limit, skip } = pagination;
    const where = buildListingWhere(req);

    const [listings, total] = await Promise.all([
      prisma.listing.findMany({
        where,
        include: {
          host: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.listing.count({ where }),
    ]);

    return res.json({
      data: listings,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error("Error in searchListings", { error, path: req.path });
    return res.status(500).json({ error: "Something went wrong" });
  }
}

export async function getListingById(req: AuthRequest, res: Response) {
  try {
    const id = req.params["id"] as string;

    if (!id) {
      return res.status(400).json({ error: "Invalid listing ID" });
    }

    const listing = await prisma.listing.findUnique({
      where: { id },
      include: {
        host: {
          select: {
            id: true,
            name: true,
            email: true,
            username: true,
            role: true,
            avatar: true,
            bio: true,
            createdAt: true,
          },
        },
        bookings: true,
        reviews: {
          include: {
            reviewer: {
              select: {
                name: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    if (!listing) {
      return res.status(404).json({ error: "Listing not found" });
    }

    return res.json(listing);
  } catch (error) {
    logger.error("Error in getListingById", { error, path: req.path });
    return res.status(500).json({ error: "Something went wrong" });
  }
}

export async function createListing(req: AuthRequest, res: Response) {
  try {
    const { title, description, location, pricePerNight, guests, type, amenities } = req.body;

    if (!title || !location || pricePerNight === undefined) {
      return res.status(400).json({
        error: "title, location and pricePerNight are required",
      });
    }

    if (!req.userId) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    const listing = await prisma.listing.create({
      data: {
        title: String(title),
        description: String(description ?? ""),
        location: String(location),
        pricePerNight: Number(pricePerNight),
        guests: guests ? Number(guests) : 1,
        type: (String(type ?? "APARTMENT").toUpperCase() as ListingType),
        amenities: Array.isArray(amenities) ? amenities.map(String) : [],
        hostId: req.userId,
      },
    });

    invalidateListingCaches();

    return res.status(201).json(listing);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return res.status(400).json({ error: "Invalid hostId" });
    }

    logger.error("Error in createListing", { error, path: req.path });
    return res.status(500).json({ error: "Something went wrong" });
  }
}

export async function updateListing(req: AuthRequest, res: Response) {
  try {
    const id = req.params["id"] as string;

    if (!id) {
      return res.status(400).json({ error: "Invalid listing ID" });
    }

    const listing = await prisma.listing.findUnique({
      where: { id },
    });

    if (!listing) {
      return res.status(404).json({ error: "Listing not found" });
    }

    if (listing.hostId !== req.userId && req.role !== "ADMIN") {
      return res.status(403).json({ error: "You can only edit your own listings" });
    }

    const { title, description, location, pricePerNight, guests, type, amenities, rating } = req.body;

    const updatedListing = await prisma.listing.update({
      where: { id },
      data: {
        ...(title !== undefined && { title: String(title) }),
        ...(description !== undefined && { description: String(description) }),
        ...(location !== undefined && { location: String(location) }),
        ...(pricePerNight !== undefined && { pricePerNight: Number(pricePerNight) }),
        ...(guests !== undefined && { guests: Number(guests) }),
        ...(type !== undefined && { type: String(type).toUpperCase() as ListingType }),
        ...(amenities !== undefined && {
          amenities: Array.isArray(amenities) ? amenities.map(String) : [],
        }),
        ...(rating !== undefined && { rating: rating === null ? null : Number(rating) }),
      },
    });

    invalidateListingCaches();

    return res.json(updatedListing);
  } catch (error) {
    logger.error("Error in updateListing", { error, path: req.path });
    return res.status(500).json({ error: "Something went wrong" });
  }
}

export async function deleteListing(req: AuthRequest, res: Response) {
  try {
    const id = req.params["id"] as string;

    if (!id) {
      return res.status(400).json({ error: "Invalid listing ID" });
    }

    const listing = await prisma.listing.findUnique({
      where: { id },
    });

    if (!listing) {
      return res.status(404).json({ error: "Listing not found" });
    }

    if (listing.hostId !== req.userId && req.role !== "ADMIN") {
      return res.status(403).json({ error: "You can only delete your own listings" });
    }

    await prisma.listing.delete({
      where: { id },
    });

    invalidateListingCaches();
    clearCacheByPrefix(`reviews:listing:${id}:`);

    return res.json({ message: "Listing deleted successfully" });
  } catch (error) {
    logger.error("Error in deleteListing", { error, path: req.path });
    return res.status(500).json({ error: "Something went wrong" });
  }
}
