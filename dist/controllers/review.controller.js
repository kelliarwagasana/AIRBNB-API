import { clearCacheByPrefix, getCache, setCache } from "../config/cache.js";
import { prisma } from "../lib/prisma.js";
import { notifyUserUnlessSelf } from "../services/notification.service.js";
async function refreshListingRating(listingId) {
    const aggregate = await prisma.review.aggregate({
        where: { listingId },
        _avg: { rating: true },
    });
    await prisma.listing.update({
        where: { id: listingId },
        data: {
            rating: aggregate._avg.rating ?? null,
        },
    });
}
function invalidateReviewCaches(listingId) {
    clearCacheByPrefix(`reviews:listing:${listingId}:`);
    clearCacheByPrefix("listings:list:");
    clearCacheByPrefix(`ai:review-summary:${listingId}`);
}
export async function getListingReviews(req, res) {
    try {
        const listingId = req.params["id"];
        const page = parseInt(req.query["page"] ?? "1", 10);
        const limit = parseInt(req.query["limit"] ?? "10", 10);
        if (Number.isNaN(listingId)) {
            return res.status(400).json({ error: "Invalid listing ID" });
        }
        if (Number.isNaN(page) || page < 1 || Number.isNaN(limit) || limit < 1) {
            return res.status(400).json({ error: "Invalid pagination parameters" });
        }
        const cacheKey = `reviews:listing:${listingId}:${page}:${limit}`;
        const cached = getCache(cacheKey);
        if (cached) {
            return res.json(cached);
        }
        const listing = await prisma.listing.findUnique({
            where: { id: listingId },
        });
        if (!listing) {
            return res.status(404).json({ error: "Listing not found" });
        }
        const [reviews, total] = await Promise.all([
            prisma.review.findMany({
                where: { listingId },
                include: {
                    reviewer: {
                        select: {
                            id: true,
                            name: true,
                            avatar: true,
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.review.count({ where: { listingId } }),
        ]);
        const payload = {
            data: reviews,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
        setCache(cacheKey, payload, 30);
        return res.json(payload);
    }
    catch {
        return res.status(500).json({ error: "Something went wrong" });
    }
}
export async function createReview(req, res) {
    try {
        const listingId = req.params["id"];
        const { userId, rating, comment } = req.body;
        if (!listingId) {
            return res.status(400).json({ error: "Invalid listing ID" });
        }
        if ((!userId && !req.userId) || rating === undefined || !comment) {
            return res.status(400).json({ error: "userId, rating and comment are required" });
        }
        const reviewerId = userId ?? req.userId;
        const numericRating = Number(rating);
        if (!reviewerId) {
            return res.status(400).json({ error: "Invalid userId" });
        }
        if (req.userId && userId && reviewerId !== req.userId && req.role !== "ADMIN") {
            return res.status(403).json({ error: "You can only create reviews for your own account" });
        }
        if (Number.isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
            return res.status(400).json({ error: "rating must be between 1 and 5" });
        }
        const [listing, reviewer] = await Promise.all([
            prisma.listing.findUnique({
                where: { id: listingId },
            }),
            prisma.user.findUnique({
                where: { id: reviewerId },
            }),
        ]);
        if (!listing) {
            return res.status(404).json({ error: "Listing not found" });
        }
        if (!reviewer) {
            return res.status(404).json({ error: "User not found" });
        }
        const review = await prisma.review.create({
            data: {
                rating: numericRating,
                comment: String(comment),
                reviewerId,
                listingId,
            },
            include: {
                reviewer: {
                    select: {
                        id: true,
                        name: true,
                        avatar: true,
                    },
                },
            },
        });
        await refreshListingRating(listingId);
        invalidateReviewCaches(listingId);
        try {
            await notifyUserUnlessSelf(listing.hostId, reviewerId, {
                type: "REVIEW_RECEIVED",
                title: "New review received",
                body: `${reviewer.name} left a ${numericRating}-star review on "${listing.title}".`,
                metadata: {
                    listingId,
                    reviewId: review.id,
                    rating: numericRating,
                    reviewerName: reviewer.name,
                },
            });
        }
        catch (error) {
            console.error("Failed to create review notification:", error);
        }
        return res.status(201).json(review);
    }
    catch {
        return res.status(500).json({ error: "Something went wrong" });
    }
}
export async function deleteReview(req, res) {
    try {
        const id = parseInt(req.params["id"], 10);
        if (!req.userId) {
            return res.status(401).json({ error: "Invalid or expired token" });
        }
        if (Number.isNaN(id)) {
            return res.status(400).json({ error: "Invalid review ID" });
        }
        const review = await prisma.review.findUnique({
            where: { id },
        });
        if (!review) {
            return res.status(404).json({ error: "Review not found" });
        }
        if (review.reviewerId !== req.userId && req.role !== "ADMIN") {
            return res.status(403).json({ error: "You can only delete your own reviews" });
        }
        await prisma.review.delete({
            where: { id },
        });
        await refreshListingRating(review.listingId);
        invalidateReviewCaches(review.listingId);
        return res.json({ message: "Review deleted successfully" });
    }
    catch {
        return res.status(500).json({ error: "Something went wrong" });
    }
}
