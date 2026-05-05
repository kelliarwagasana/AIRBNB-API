import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import * as aiConfig from "../config/ai.js";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { getCache, setCache } from "../config/cache.js";
const sessionHistory = new Map();
function parsePagination(req) {
    const page = parseInt(req.query["page"] ?? "1", 10);
    const limit = parseInt(req.query["limit"] ?? "10", 10);
    if (Number.isNaN(page) || page < 1 || Number.isNaN(limit) || limit < 1) {
        return null;
    }
    return { page, limit, skip: (page - 1) * limit };
}
function normalizeFilters(raw) {
    const rawType = typeof raw["type"] === "string" ? raw["type"].toUpperCase() : null;
    const validTypes = ["APARTMENT", "HOUSE", "VILLA", "CABIN"];
    return {
        location: typeof raw["location"] === "string" && raw["location"].trim().length > 0
            ? raw["location"].trim()
            : null,
        type: rawType && validTypes.includes(rawType) ? rawType : null,
        maxPrice: typeof raw["maxPrice"] === "number" && Number.isFinite(raw["maxPrice"]) && raw["maxPrice"] > 0
            ? raw["maxPrice"]
            : null,
        guests: typeof raw["guests"] === "number" && Number.isFinite(raw["guests"]) && raw["guests"] > 0
            ? Math.floor(raw["guests"])
            : null,
    };
}
function hasAtLeastOneFilter(filters) {
    return Object.values(filters).some((value) => value !== null);
}
function buildWhere(filters) {
    const where = {};
    if (filters.location) {
        where.location = {
            contains: filters.location,
            mode: "insensitive",
        };
    }
    if (filters.type) {
        where.type = filters.type;
    }
    if (filters.maxPrice !== null) {
        where.pricePerNight = {
            lte: filters.maxPrice,
        };
    }
    if (filters.guests !== null) {
        where.guests = {
            gte: filters.guests,
        };
    }
    return where;
}
function parseJson(value) {
    const trimmed = value.trim();
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end === -1 || end < start) {
        throw new Error("AI returned invalid JSON");
    }
    return JSON.parse(trimmed.slice(start, end + 1));
}
function handleAiError(error, res) {
    const anyError = error;
    const status = anyError?.status ?? anyError?.response?.status;
    if (status === 429) {
        return res.status(429).json({ error: "AI service is busy, please try again in a moment" });
    }
    if (status === 401) {
        return res.status(500).json({ error: "AI service configuration error" });
    }
    logger.error("AI request failed", { error: anyError });
    return res.status(500).json({ error: "AI service error" });
}
const structuredExtractor = aiConfig.aiSearchModel.withStructuredOutput(aiConfig.listingSearchFilterSchema, {
    name: "extract_listing_search_filters",
});
export async function searchListingsWithAI(req, res) {
    try {
        if (!process.env["GROQ_API_KEY"]) {
            return res.status(500).json({ error: "AI search is not configured on the server" });
        }
        const pagination = parsePagination(req);
        if (!pagination) {
            return res.status(400).json({ error: "Invalid pagination parameters" });
        }
        const query = typeof req.body?.query === "string" ? req.body.query.trim() : "";
        if (!query) {
            return res.status(400).json({ error: "query is required" });
        }
        const extracted = await structuredExtractor.invoke([
            new SystemMessage("Extract listing search filters from the user's request. Return only supported filters. If a filter cannot be inferred, return null for that field."),
            new HumanMessage(query),
        ]);
        const filters = normalizeFilters(extracted);
        if (!hasAtLeastOneFilter(filters)) {
            return res.status(400).json({
                error: "Could not extract any filters from your query, please be more specific",
            });
        }
        const where = buildWhere(filters);
        const { page, limit, skip } = pagination;
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
            filters,
            data: listings,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        });
    }
    catch (error) {
        logger.error("Error in searchListingsWithAI", { error, path: req.path });
        if (error?.status === 429) {
            return res.status(429).json({ error: "AI service is busy, please try again in a moment" });
        }
        return res.status(500).json({ error: "Something went wrong" });
    }
}
function buildListingDescriptionPrompt(listing, tone) {
    const toneDescriptions = {
        professional: "Write a formal, clear, business-like listing description.",
        casual: "Write a friendly, relaxed, conversational listing description.",
        luxury: "Write an elegant, premium, aspirational listing description.",
    };
    const toneInstruction = toneDescriptions[tone] ?? toneDescriptions.professional;
    return `You are a professional listing description writer. ${toneInstruction}

Listing details:
Title: ${listing.title}
Location: ${listing.location}
Price per night: $${listing.pricePerNight}
Max guests: ${listing.guests}
Type: ${listing.type}
Amenities: ${listing.amenities.join(", ")}
Current description: ${listing.description}

Generate one polished listing description in 2-3 sentences. Do not include any metadata or numbering.`;
}
export async function generateListingDescription(req, res) {
    try {
        const listingId = req.params["id"];
        const userId = req.userId;
        if (!listingId) {
            return res.status(400).json({ error: "Listing ID is required" });
        }
        const tone = typeof req.body?.tone === "string" ? req.body.tone.toLowerCase() : "professional";
        const validTones = ["professional", "casual", "luxury"];
        if (!validTones.includes(tone)) {
            return res.status(400).json({ error: "tone must be professional, casual, or luxury" });
        }
        const listing = await prisma.listing.findUnique({
            where: { id: listingId },
        });
        if (!listing) {
            return res.status(404).json({ error: "Listing not found" });
        }
        if (!userId) {
            return res.status(401).json({ error: "Authentication required" });
        }
        if (listing.hostId !== userId) {
            return res.status(403).json({ error: "You are not the owner of this listing" });
        }
        const prompt = buildListingDescriptionPrompt(listing, tone);
        const responseText = await aiConfig.llm.invoke([
            new SystemMessage("You are a helpful assistant that writes Airbnb listing descriptions."),
            new HumanMessage(prompt),
        ]);
        const generatedDescription = String(responseText).trim();
        const updatedListing = await prisma.listing.update({
            where: { id: listingId },
            data: { description: generatedDescription },
        });
        return res.json({ description: generatedDescription, listing: updatedListing });
    }
    catch (error) {
        logger.error("Error in generateListingDescription", { error, path: req.path });
        return handleAiError(error, res);
    }
}
function buildChatSystemPrompt(listing) {
    if (!listing) {
        return "You are a helpful guest support assistant for an Airbnb-like platform. Answer guest questions clearly and politely.";
    }
    return `You are a helpful guest support assistant for an Airbnb-like platform.
You are currently helping a guest with questions about this specific listing:

Title: ${listing.title}
Location: ${listing.location}
Price per night: $${listing.pricePerNight}
Max guests: ${listing.guests}
Type: ${listing.type}
Amenities: ${listing.amenities.join(", ")}
Description: ${listing.description}

Answer questions about this listing accurately based on the details above.
If asked something not covered by the listing details, say you don't have that information.`;
}
export async function chatWithAi(req, res) {
    try {
        const { sessionId, listingId, message } = req.body ?? {};
        if (!sessionId || typeof sessionId !== "string") {
            return res.status(400).json({ error: "sessionId is required" });
        }
        if (!message || typeof message !== "string") {
            return res.status(400).json({ error: "message is required" });
        }
        let listing;
        if (listingId) {
            listing = await prisma.listing.findUnique({
                where: { id: listingId },
            });
            if (!listing) {
                return res.status(404).json({ error: "Listing not found" });
            }
        }
        const history = sessionHistory.get(sessionId) ?? [];
        history.push({ role: "user", content: message });
        const trimmedHistory = history.slice(-20);
        sessionHistory.set(sessionId, trimmedHistory);
        const messages = [
            new SystemMessage(buildChatSystemPrompt(listing)),
        ];
        for (const item of trimmedHistory) {
            if (item.role === "user") {
                messages.push(new HumanMessage(item.content));
            }
            else {
                messages.push(new AIMessage(item.content));
            }
        }
        const aiResponse = await aiConfig.llm.invoke(messages);
        const assistantText = String(aiResponse).trim();
        trimmedHistory.push({ role: "assistant", content: assistantText });
        sessionHistory.set(sessionId, trimmedHistory.slice(-20));
        return res.json({ response: assistantText, sessionId, messageCount: sessionHistory.get(sessionId)?.length ?? 0 });
    }
    catch (error) {
        logger.error("Error in chatWithAi", { error, path: req.path });
        return handleAiError(error, res);
    }
}
function buildBookingHistorySummary(bookings) {
    const lines = bookings.map((booking, index) => {
        const listing = booking.listing;
        return `Booking ${index + 1}: ${listing.title} in ${listing.location}, ${listing.type.toLowerCase()} for ${listing.guests} guest(s) at $${listing.pricePerNight}/night.`;
    });
    return `The user has the following recent booking history:
${lines.join("\n")}`;
}
export async function recommendListings(req, res) {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ error: "Authentication required" });
        }
        const bookings = await prisma.booking.findMany({
            where: { guestId: userId },
            orderBy: { createdAt: "desc" },
            take: 5,
            include: {
                listing: true,
            },
        });
        if (!bookings.length) {
            return res.status(400).json({ error: "No booking history found. Make some bookings first to get recommendations." });
        }
        const historyText = buildBookingHistorySummary(bookings);
        const prompt = `${historyText}

Based on this booking history, infer the user's preferences and return a JSON object with preferences, searchFilters, and reason. Only return valid JSON in this format:
{
  "preferences": "string describing what the user likes",
  "searchFilters": {
    "location": "string or null",
    "type": "string or null",
    "maxPrice": "number or null",
    "guests": "number or null"
  },
  "reason": "string explaining the recommendation"
}`;
        const aiResponse = await aiConfig.llm.invoke([
            new SystemMessage("You are a smart recommendation assistant. Return only JSON in the requested format."),
            new HumanMessage(prompt),
        ]);
        const parsed = parseJson(String(aiResponse));
        const filterClauses = [
            {
                id: {
                    notIn: bookings.map((booking) => booking.listing.id),
                },
            },
        ];
        if (parsed.searchFilters.location) {
            filterClauses.push({
                location: {
                    contains: parsed.searchFilters.location,
                    mode: "insensitive",
                },
            });
        }
        if (parsed.searchFilters.type) {
            filterClauses.push({ type: parsed.searchFilters.type });
        }
        if (parsed.searchFilters.maxPrice !== null) {
            filterClauses.push({ pricePerNight: { lte: parsed.searchFilters.maxPrice } });
        }
        if (parsed.searchFilters.guests !== null) {
            filterClauses.push({ guests: { gte: Math.floor(parsed.searchFilters.guests) } });
        }
        const filters = {
            AND: filterClauses,
        };
        const recommendations = await prisma.listing.findMany({
            where: filters,
            include: {
                host: {
                    select: {
                        name: true,
                        email: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
            take: 10,
        });
        return res.json({
            preferences: parsed.preferences,
            reason: parsed.reason,
            searchFilters: parsed.searchFilters,
            recommendations,
        });
    }
    catch (error) {
        logger.error("Error in recommendListings", { error, path: req.path });
        return handleAiError(error, res);
    }
}
export async function getListingReviewSummary(req, res) {
    try {
        const listingId = req.params["id"];
        const cacheKey = `ai:review-summary:${listingId}`;
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
        const reviews = await prisma.review.findMany({
            where: { listingId },
            include: {
                reviewer: {
                    select: {
                        name: true,
                    },
                },
            },
        });
        if (reviews.length < 3) {
            return res.status(400).json({ error: "Not enough reviews to generate a summary (minimum 3 required)" });
        }
        const formattedReviews = reviews
            .map((review, index) => `Review ${index + 1} (rating: ${review.rating}) by ${review.reviewer.name}: ${review.comment ?? "No comment"}`)
            .join("\n");
        const prompt = `Summarize the following reviews for a listing. Return only JSON with keys: summary, positives, negatives. Do not calculate average rating; only analyze the review text.

Reviews:
${formattedReviews}`;
        const aiResponse = await aiConfig.llm.invoke([
            new SystemMessage("You are a helpful assistant that summarizes guest reviews into a structured JSON object."),
            new HumanMessage(prompt),
        ]);
        const parsed = parseJson(String(aiResponse));
        const averageRating = Number((reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1));
        const payload = {
            summary: parsed.summary,
            positives: parsed.positives,
            negatives: parsed.negatives,
            averageRating,
            totalReviews: reviews.length,
        };
        setCache(cacheKey, payload, 600);
        return res.json(payload);
    }
    catch (error) {
        logger.error("Error in getListingReviewSummary", { error, path: req.path });
        return handleAiError(error, res);
    }
}
