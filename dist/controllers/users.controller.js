import bcrypt from "bcrypt";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
function sanitizeUser(user) {
    const { password: _password, ...userWithoutPassword } = user;
    return userWithoutPassword;
}
function parsePagination(req) {
    const page = parseInt(req.query["page"] ?? "1", 10);
    const limit = parseInt(req.query["limit"] ?? "10", 10);
    if (Number.isNaN(page) || page < 1 || Number.isNaN(limit) || limit < 1) {
        return null;
    }
    return { page, limit, skip: (page - 1) * limit };
}
export async function getAllUsers(req, res) {
    try {
        const pagination = parsePagination(req);
        if (!pagination) {
            return res.status(400).json({ error: "Invalid pagination parameters" });
        }
        const { page, limit, skip } = pagination;
        const [users, total] = await Promise.all([
            prisma.user.findMany({
                include: {
                    _count: {
                        select: { listings: true },
                    },
                },
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
            }),
            prisma.user.count(),
        ]);
        return res.json({
            data: users.map((user) => sanitizeUser(user)),
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        });
    }
    catch (error) {
        logger.error("Error in getAllUsers", { error, path: req.path });
        return res.status(500).json({ error: "Something went wrong" });
    }
}
export async function getUserById(req, res) {
    try {
        const id = req.params["id"];
        if (!id) {
            return res.status(400).json({ error: "Invalid user ID" });
        }
        const user = await prisma.user.findUnique({
            where: { id },
            include: {
                listings: true,
                bookings: {
                    include: {
                        listing: true,
                    },
                },
            },
        });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        return res.json(sanitizeUser(user));
    }
    catch (error) {
        logger.error("Error in getUserById", { error, path: req.path });
        return res.status(500).json({ error: "Something went wrong" });
    }
}
export async function getUserListings(req, res) {
    try {
        const id = req.params["id"];
        const pagination = parsePagination(req);
        if (!id) {
            return res.status(400).json({ error: "Invalid user ID" });
        }
        if (!pagination) {
            return res.status(400).json({ error: "Invalid pagination parameters" });
        }
        const user = await prisma.user.findUnique({
            where: { id },
        });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        const { page, limit, skip } = pagination;
        const [listings, total] = await Promise.all([
            prisma.listing.findMany({
                where: { hostId: id },
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
            }),
            prisma.listing.count({
                where: { hostId: id },
            }),
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
    }
    catch (error) {
        logger.error("Error in getUserListings", { error, path: req.path });
        return res.status(500).json({ error: "Something went wrong" });
    }
}
export async function getUserBookings(req, res) {
    try {
        const id = req.params["id"];
        const pagination = parsePagination(req);
        if (!id) {
            return res.status(400).json({ error: "Invalid user ID" });
        }
        if (!pagination) {
            return res.status(400).json({ error: "Invalid pagination parameters" });
        }
        const user = await prisma.user.findUnique({
            where: { id },
        });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        const { page, limit, skip } = pagination;
        const [bookings, total] = await Promise.all([
            prisma.booking.findMany({
                where: { guestId: id },
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
            prisma.booking.count({
                where: { guestId: id },
            }),
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
    }
    catch (error) {
        logger.error("Error in getUserBookings", { error, path: req.path });
        return res.status(500).json({ error: "Something went wrong" });
    }
}
export async function createUser(req, res) {
    try {
        const { name, email, username, phone, password, role, avatar, bio } = req.body;
        if (!name || !email || !username || !phone || !password) {
            return res.status(400).json({
                error: "name, email, username, phone and password are required",
            });
        }
        const hashedPassword = await bcrypt.hash(String(password), 10);
        const newUser = await prisma.user.create({
            data: {
                name: String(name),
                email: String(email),
                username: String(username),
                phone: String(phone),
                password: hashedPassword,
                role: role === "HOST" || role === "GUEST" || role === "ADMIN" ? role : "GUEST",
                avatar: avatar ?? null,
                bio: bio ?? null,
            },
        });
        return res.status(201).json(sanitizeUser(newUser));
    }
    catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            logger.warn("Duplicate email/username", { code: error.code, meta: error.meta });
            return res.status(409).json({ error: "Email or username already exists" });
        }
        logger.error("Error in createUser", { error, path: req.path });
        return res.status(500).json({ error: "Something went wrong" });
    }
}
export async function updateUser(req, res) {
    try {
        const id = req.params["id"];
        if (!id) {
            return res.status(400).json({ error: "Invalid user ID" });
        }
        const existingUser = await prisma.user.findUnique({
            where: { id },
        });
        if (!existingUser) {
            return res.status(404).json({ error: "User not found" });
        }
        const { name, email, username, phone, role, avatar, bio, password } = req.body;
        const updatedUser = await prisma.user.update({
            where: { id },
            data: {
                ...(name !== undefined && { name: String(name) }),
                ...(email !== undefined && { email: String(email) }),
                ...(username !== undefined && { username: String(username) }),
                ...(phone !== undefined && { phone: String(phone) }),
                ...(role !== undefined && (role === "HOST" || role === "GUEST" || role === "ADMIN") ? { role } : {}),
                ...(avatar !== undefined && { avatar }),
                ...(bio !== undefined && { bio }),
                ...(password !== undefined && { password: await bcrypt.hash(String(password), 10) }),
            },
        });
        return res.json(sanitizeUser(updatedUser));
    }
    catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            logger.warn("Duplicate email/username", { code: error.code, meta: error.meta });
            return res.status(409).json({ error: "Email or username already exists" });
        }
        logger.error("Error in updateUser", { error, path: req.path });
        return res.status(500).json({ error: "Something went wrong" });
    }
}
export async function deleteUser(req, res) {
    try {
        const id = req.params["id"];
        if (!id) {
            return res.status(400).json({ error: "Invalid user ID" });
        }
        const existingUser = await prisma.user.findUnique({
            where: { id },
        });
        if (!existingUser) {
            return res.status(404).json({ error: "User not found" });
        }
        await prisma.user.delete({
            where: { id },
        });
        return res.json({ message: "User deleted successfully" });
    }
    catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
            logger.warn("User not found", { code: error.code, meta: error.meta });
            return res.status(404).json({ error: "User not found" });
        }
        logger.error("Error in deleteUser", { error, path: req.path });
        return res.status(500).json({ error: "Something went wrong" });
    }
}
