import { Prisma } from "@prisma/client";
import { clearCacheByPrefix, getCache, setCache } from "../config/cache.js";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
function parsePagination(req) {
    const page = parseInt(req.query["page"] ?? "1", 10);
    const limit = parseInt(req.query["limit"] ?? "10", 10);
    if (Number.isNaN(page) || page < 1 || Number.isNaN(limit) || limit < 1) {
        return null;
    }
    return { page, limit, skip: (page - 1) * limit };
}
function buildListingWhere(req) {
    const { location, type, minPrice, maxPrice, guests } = req.query;
    const where = { status: "PUBLISHED" };
    if (location) {
        where.location = {
            contains: String(location),
            mode: "insensitive",
        };
    }
    if (type) {
        where.type = String(type).toUpperCase();
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
/** Adds `coverUrl` for clients; Prisma Studio users often look at `Listing.url` only — we keep that in sync on write. */
function attachListingCover(listing) {
    const coverUrl = listing.photos?.[0]?.url ?? listing.url ?? null;
    return { ...listing, coverUrl };
}
function attachListingCovers(listings) {
    return listings.map(attachListingCover);
}
function parsePhotoInputs(body) {
    const urls = [];
    const imageUrl = body["imageUrl"];
    if (typeof imageUrl === "string" && imageUrl.trim().length > 0) {
        urls.push(imageUrl.trim());
    }
    const photos = body["photos"];
    if (Array.isArray(photos)) {
        for (const item of photos) {
            if (typeof item === "string" && item.trim().length > 0) {
                urls.push(item.trim());
                continue;
            }
            if (item && typeof item === "object") {
                const url = item.url;
                if (typeof url === "string" && url.trim().length > 0) {
                    urls.push(url.trim());
                }
            }
        }
    }
    return [...new Set(urls)];
}
export async function getAllListings(req, res) {
    try {
        const pagination = parsePagination(req);
        if (!pagination) {
            return res.status(400).json({ error: "Invalid pagination parameters" });
        }
        const { page, limit, skip } = pagination;
        const bypassCache = req.query["refresh"] === "1" || req.query["nocache"] === "1";
        // Cache must vary by guest because we add booking-derived fields.
        const userKey = req.userId ? `guest:${req.userId}` : 'guest:anon';
        const cacheKey = `listings:list:${userKey}:${JSON.stringify(req.query)}`;
        const cached = bypassCache ? null : getCache(cacheKey);
        if (cached) {
            return res.json(cached);
        }
        const where = buildListingWhere(req);
        const [listings, total] = await Promise.all([
            prisma.listing.findMany({
                where,
                include: {
                    photos: true,
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
        const listingIds = listings.map((l) => l.id);
        // Booked (holds/paid): any booking that is not CANCELLED.
        let isBookedByMeMap = {};
        if (req.userId && listingIds.length) {
            const myBookings = await prisma.booking.findMany({
                where: {
                    guestId: req.userId,
                    listingId: { in: listingIds },
                    status: { in: ["PENDING", "CONFIRMED"] },
                },
                select: { listingId: true },
            });
            isBookedByMeMap = myBookings.reduce((acc, b) => {
                acc[b.listingId] = true;
                return acc;
            }, {});
        }
        const payload = {
            data: attachListingCovers(listings).map((l) => ({
                ...l,
                isBookedByMe: req.userId ? Boolean(isBookedByMeMap[l.id]) : false,
            })),
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
        if (!bypassCache) {
            setCache(cacheKey, payload, 30);
        }
        return res.json(payload);
    }
    catch (error) {
        logger.error("Error in getAllListings", { error, path: req.path });
        return res.status(500).json({ error: "Something went wrong" });
    }
}
export async function searchListings(req, res) {
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
                    photos: true,
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
            data: attachListingCovers(listings),
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        });
    }
    catch (error) {
        logger.error("Error in searchListings", { error, path: req.path });
        return res.status(500).json({ error: "Something went wrong" });
    }
}
export async function getMineListings(req, res) {
    try {
        if (!req.userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const listings = await prisma.listing.findMany({
            where: { hostId: req.userId },
            include: {
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
                photos: true,
                reviews: true,
            },
            orderBy: { createdAt: "desc" },
        });
        return res.json(attachListingCovers(listings));
    }
    catch (error) {
        logger.error("Error in getMineListings", { error, path: req.path });
        return res.status(500).json({ error: "Something went wrong" });
    }
}
export async function getPendingListings(_req, res) {
    try {
        const listings = await prisma.listing.findMany({
            where: { status: "PENDING_APPROVAL" },
            include: {
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
                photos: true,
                reviews: true,
            },
            orderBy: { createdAt: "desc" },
        });
        return res.json(attachListingCovers(listings));
    }
    catch (error) {
        logger.error("Error in getPendingListings", { error, path: _req.path });
        return res.status(500).json({ error: "Something went wrong" });
    }
}
export async function getListingById(req, res) {
    try {
        const id = req.params["id"];
        if (!id) {
            return res.status(400).json({ error: "Invalid listing ID" });
        }
        const listing = await prisma.listing.findUnique({
            where: { id },
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
                        bio: true,
                        createdAt: true,
                    },
                },
                bookings: true,
                reviews: {
                    include: {
                        reviewer: {
                            select: {
                                id: true,
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
        return res.json(attachListingCover(listing));
    }
    catch (error) {
        logger.error("Error in getListingById", { error, path: req.path });
        return res.status(500).json({ error: "Something went wrong" });
    }
}
export async function createListing(req, res) {
    try {
        const { title, description, location, pricePerNight, guests, guest, type, amenities } = req.body;
        if (!title || !location || pricePerNight === undefined) {
            return res.status(400).json({
                error: "title, location and pricePerNight are required",
            });
        }
        if (!req.userId) {
            return res.status(401).json({ error: "Invalid or expired token" });
        }
        const guestCount = guests !== undefined && guests !== null
            ? Number(guests)
            : guest !== undefined && guest !== null
                ? Number(guest)
                : 1;
        const photoUrls = parsePhotoInputs(req.body);
        const listing = await prisma.listing.create({
            data: {
                title: String(title),
                description: String(description ?? ""),
                location: String(location),
                pricePerNight: Number(pricePerNight),
                guests: Number.isFinite(guestCount) && guestCount > 0 ? guestCount : 1,
                type: String(type ?? "APARTMENT").toUpperCase(),
                amenities: Array.isArray(amenities) ? amenities.map(String) : [],
                hostId: req.userId,
                status: "PENDING_APPROVAL",
                url: photoUrls[0] ?? undefined,
                photos: photoUrls.length
                    ? {
                        create: photoUrls.map((url) => ({ url })),
                    }
                    : undefined,
            },
            include: {
                photos: true,
            },
        });
        invalidateListingCaches();
        return res.status(201).json(attachListingCover(listing));
    }
    catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
            return res.status(400).json({ error: "Invalid hostId" });
        }
        logger.error("Error in createListing", { error, path: req.path });
        return res.status(500).json({ error: "Something went wrong" });
    }
}
export async function updateListingStatus(req, res) {
    try {
        const id = req.params["id"];
        const status = String(req.body?.status ?? "").toUpperCase();
        if (!id) {
            return res.status(400).json({ error: "Invalid listing ID" });
        }
        if (!["PENDING_APPROVAL", "PUBLISHED", "REJECTED"].includes(status)) {
            return res.status(400).json({ error: "Invalid listing status" });
        }
        const listing = await prisma.listing.update({
            where: { id },
            data: { status },
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
        });
        invalidateListingCaches();
        return res.json(attachListingCover(listing));
    }
    catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
            return res.status(404).json({ error: "Listing not found" });
        }
        logger.error("Error in updateListingStatus", { error, path: req.path });
        return res.status(500).json({ error: "Something went wrong" });
    }
}
export async function updateListing(req, res) {
    try {
        const id = req.params["id"];
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
        const photoUrls = parsePhotoInputs(req.body);
        const updatedListing = await prisma.listing.update({
            where: { id },
            data: {
                ...(title !== undefined && { title: String(title) }),
                ...(description !== undefined && { description: String(description) }),
                ...(location !== undefined && { location: String(location) }),
                ...(pricePerNight !== undefined && { pricePerNight: Number(pricePerNight) }),
                ...(guests !== undefined && { guests: Number(guests) }),
                ...(type !== undefined && { type: String(type).toUpperCase() }),
                ...(amenities !== undefined && {
                    amenities: Array.isArray(amenities) ? amenities.map(String) : [],
                }),
                ...(rating !== undefined && { rating: rating === null ? null : Number(rating) }),
                ...(photoUrls.length > 0 && {
                    url: photoUrls[0],
                    photos: {
                        deleteMany: {},
                        create: photoUrls.map((url) => ({ url })),
                    },
                }),
            },
            include: {
                photos: true,
            },
        });
        invalidateListingCaches();
        return res.json(attachListingCover(updatedListing));
    }
    catch (error) {
        logger.error("Error in updateListing", { error, path: req.path });
        return res.status(500).json({ error: "Something went wrong" });
    }
}
export async function deleteListing(req, res) {
    try {
        const id = req.params["id"];
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
        await prisma.$transaction(async (tx) => {
            await tx.booking.deleteMany({ where: { listingId: id } });
            await tx.listing.delete({
                where: { id },
            });
        });
        invalidateListingCaches();
        clearCacheByPrefix(`reviews:listing:${id}:`);
        return res.json({ message: "Listing deleted successfully" });
    }
    catch (error) {
        logger.error("Error in deleteListing", { error, path: req.path });
        return res.status(500).json({ error: "Something went wrong" });
    }
}
