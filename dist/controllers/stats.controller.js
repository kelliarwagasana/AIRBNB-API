import { prisma } from "../lib/prisma.js";
import { getCache, setCache } from "../config/cache";
export async function getListingStats(req, res, next) {
    try {
        const listingId = req.params.id;
        const cacheKey = `stats:listing:${listingId}`;
        const cached = getCache(cacheKey);
        if (cached) {
            res.json(cached);
            return;
        }
        const listing = await prisma.listing.findUnique({ where: { id: listingId } });
        if (!listing) {
            res.status(404).json({ error: "Listing not found" });
            return;
        }
        const [totalBookings, confirmedBookings, reviews] = await Promise.all([
            prisma.booking.count({ where: { listingId } }),
            prisma.booking.findMany({ where: { listingId, status: "CONFIRMED" }, select: { totalPrice: true } }),
            prisma.review.findMany({ where: { listingId }, select: { rating: true } }),
        ]);
        const totalRevenue = confirmedBookings.reduce((sum, b) => sum + b.totalPrice, 0);
        const averageRating = reviews.length > 0
            ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
            : null;
        const stats = {
            listingId,
            totalBookings,
            confirmedBookings: confirmedBookings.length,
            totalRevenue,
            totalReviews: reviews.length,
            averageRating: averageRating !== null ? Math.round(averageRating * 10) / 10 : null,
        };
        setCache(cacheKey, stats, 300);
        res.json(stats);
    }
    catch (error) {
        next(error);
    }
}
export async function getUserStats(req, res, next) {
    try {
        const userId = req.params.id;
        const cacheKey = `stats:user:${userId}`;
        const cached = getCache(cacheKey);
        if (cached) {
            res.json(cached);
            return;
        }
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            res.status(404).json({ error: "User not found" });
            return;
        }
        let stats = { userId, role: user.role };
        if (user.role === "HOST") {
            const [listings, bookingsOnListings] = await Promise.all([
                prisma.listing.findMany({ where: { hostId: userId }, select: { id: true } }),
                prisma.booking.findMany({
                    where: { listing: { hostId: userId }, status: "CONFIRMED" },
                    select: { totalPrice: true },
                }),
            ]);
            const totalListings = listings.length;
            const listingIds = listings.map((l) => l.id);
            const totalBookings = await prisma.booking.count({ where: { listingId: { in: listingIds } } });
            const totalRevenue = bookingsOnListings.reduce((sum, b) => sum + b.totalPrice, 0);
            stats = { ...stats, totalListings, totalBookings, totalRevenue };
        }
        else if (user.role === "GUEST") {
            const [totalBookings, confirmedBookings] = await Promise.all([
                prisma.booking.count({ where: { guestId: userId } }),
                prisma.booking.findMany({ where: { guestId: userId, status: "CONFIRMED" }, select: { totalPrice: true } }),
            ]);
            const totalSpent = confirmedBookings.reduce((sum, b) => sum + b.totalPrice, 0);
            stats = { ...stats, totalBookings, totalSpent };
        }
        setCache(cacheKey, stats, 300);
        res.json(stats);
    }
    catch (error) {
        next(error);
    }
}
