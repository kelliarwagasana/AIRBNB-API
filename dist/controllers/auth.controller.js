import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import { sendEmail } from "../config/email.js";
import { welcomeEmail } from "../templates/email.js";
import crypto from "crypto";
import { passwordResetEmail } from "../templates/email.js";
const JWT_SECRET = process.env["JWT_SECRET"];
export async function register(req, res) {
    const { name, email, phone, username, password, role } = req.body;
    if (!name || !email || !phone || !username || !password) {
        return res.status(400).json({ error: "All fields are required" });
    }
    if (password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    const existing = await prisma.user.findFirst({
        where: { OR: [{ email }, { username }] },
    });
    if (existing) {
        return res.status(409).json({ error: "Email or username already in use" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
        data: { name: name, email: email, username: username, phone: phone, password: hashedPassword, role: role ?? "GUEST" },
    });
    try {
        await sendEmail({ to: user.email, subject: "welcome to Airbnb", html: welcomeEmail(user.name, user.role), });
    }
    catch (emailError) {
        console.error("Failed to send welcome email:", emailError);
    }
    const { password: _, ...userWithoutPassword } = user;
    res.status(201).json(userWithoutPassword);
}
//LOGsIN
export async function login(req, res) {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    // Same error message whether email or password is wrong
    // Never tell the client which one failed — that leaks information
    if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        return res.status(401).json({ error: "Invalid credentials" });
    }
    // Include role in the token so middleware can check it without a DB query
    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
    const { password: _, ...userWithoutPassword } = user;
    res.json({ token });
}
//CHANDE-PASSWORD 
export async function changePassword(req, res) {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "currentPassword and newPassword are required" });
    }
    if (newPassword.length < 8) {
        return res.status(400).json({ error: "New password must be at least 8 characters" });
    }
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user)
        return res.status(404).json({ error: "User not found" });
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
        return res.status(401).json({ error: "Current password is incorrect" });
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
        where: { id: req.userId },
        data: { password: hashedPassword },
    });
    res.json({ message: "Password changed successfully" });
}
//FORGOT-PASSWORD
export async function forgotPassword(req, res) {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: "Email is required" });
        }
        const successResponse = {
            message: "If this email exists, a reset link has been sent",
        };
        const user = await prisma.user.findUnique({
            where: { email },
        });
        if (!user)
            return res.status(200).json(successResponse);
        const rawToken = crypto.randomBytes(32).toString("hex");
        const hashedToken = crypto
            .createHash("sha256")
            .update(rawToken)
            .digest("hex");
        await prisma.user.update({
            where: { id: user.id },
            data: {
                resetToken: hashedToken,
                resetTokenExpiry: new Date(Date.now() + 60 * 60 * 1000),
            },
        });
        const resetLink = `${process.env["API_URL"] || "http://localhost:3000"}/auth/reset-password/${rawToken}`;
        try {
            await sendEmail({
                to: user.email,
                subject: "Reset your password 🔐",
                html: passwordResetEmail(user.name, resetLink),
            });
        }
        catch (emailError) {
            console.error("❌ Failed to send reset email:", emailError);
        }
        return res.status(200).json(successResponse);
    }
    catch (error) {
        return res.status(500).json({ error: "Something went wrong" });
    }
}
//RESET-PASSWORD
export async function resetPassword(req, res) {
    const { token } = req.params;
    const { password } = req.body;
    if (!password || password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    // Hash the raw token from the URL to compare against the stored hash
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await prisma.user.findFirst({
        where: {
            resetToken: hashedToken,
            resetTokenExpiry: { gt: new Date() }, // token must not be expired
        },
    });
    // Same error for both invalid token and expired token — don't reveal which
    if (!user) {
        return res.status(400).json({ error: "Invalid or expired reset token" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.update({
        where: { id: user.id },
        data: {
            password: hashedPassword,
            resetToken: null, // clear token after use — one-time use only
            resetTokenExpiry: null,
        },
    });
    res.json({ message: "Password reset successfully" });
}
