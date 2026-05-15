import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import { sendEmail } from "../config/email.js";
import { welcomeEmail} from "../templates/email.js";
import { AuthRequest } from "../middleware/auth.middleware.js";
import crypto from "crypto";
import { passwordResetEmail } from "../templates/email.js";
import {uploadToCloudinary, } from "../config/cloudinary.js";
const JWT_SECRET = process.env["JWT_SECRET"] as string;

export async function register(req: Request, res: Response) {
  const raw = req.body as Record<string, unknown>;
  const name = String(raw["name"] ?? "").trim();
  const email = String(raw["email"] ?? "").trim().toLowerCase();
  const phone = String(raw["phone"] ?? "").trim();
  const username = String(raw["username"] ?? "").trim();
  const password = String(raw["password"] ?? "");
  const role = raw["role"] as string | undefined;
  const missing: string[] = [];
  if (!name) missing.push("full name");
  if (!email) missing.push("email");
  if (!phone) missing.push("phone");
  if (!username) missing.push("username");
  if (!password) missing.push("password");

  if (missing.length > 0) {
    return res.status(400).json({
      error: `Missing required field(s): ${missing.join(", ")}. Please fill in every field to create your account.`,
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      error: "Password must be at least 8 characters long.",
    });
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });
  if (existing) {
    return res.status(409).json({
      error: "That email or username is already registered. Try logging in or use a different email or username.",
    });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const normalizedRole = role === "HOST" ? "HOST" : "GUEST";

  const user = await prisma.user.create({
    data: {
      name,
      email,
      username,
      phone,
      password: hashedPassword,
      role: normalizedRole,
    },
  }); 


  try { 
     await sendEmail(user.email, "welcome to Airbnb", welcomeEmail(user.name, user.role));
} catch (emailError) { console.error("Failed to send welcome email:", emailError); }

  const { password: _, ...userWithoutPassword } = user;

  const token = jwt.sign(
    { userId: user.id, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" },
  );

  res.status(201).json({ user: userWithoutPassword, token,message:"user created successfully" });
}


//LOGsIN



export async function login(req: Request, res: Response) {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");

  if (!email || !password) {
    return res.status(400).json({
      error: "Email and password are both required. Enter the email and password for your account.",
    });
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Same error message whether email or password is wrong
  // Never tell the client which one failed — that leaks information
  if (!user || user.isActive === false) {
    return res.status(401).json({
      error: "Login failed. Check your email and password, then try again.",
    });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({
      error: "Login failed. Check your email and password, then try again.",
    });
  }

  // Include role in the token so middleware can check it without a DB query
  const token = jwt.sign(
    { userId: user.id, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  const { password: _, ...userWithoutPassword } = user;
  res.json({ user: userWithoutPassword, token });
}



//CHANDE-PASSWORD 



export async function changePassword(req: AuthRequest, res: Response) {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "currentPassword and newPassword are required" });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: "New password must be at least 8 characters" });
  }

  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: "User not found" });

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

export async function forgotPassword(req: Request, res: Response) {
  try {
    const email = String(req.body?.email ?? "").trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const successResponse: { message: string; info?: string } = {
      message:
        "If an account exists for that email, we sent password reset instructions. Check your inbox and spam folder.",
    };

    const isDev = process.env["NODE_ENV"] !== "production";
    // if (isDev && !isEmailConfigured()) {
    //   successResponse.info =
    //     "SMTP is not configured (set EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS, EMAIL_FROM). No email will be sent until then. In development, a reset link may be printed in the API server console when the account exists.";
    // }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) return res.status(200).json(successResponse);

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

    const frontendUrl = process.env["FRONTEND_URL"] || "http://localhost:5173/#";
    const resetLink = `${frontendUrl}/reset-password?token=${rawToken}`;

    // if (!isEmailConfigured()) {
    //   if (isDev) {
    //     console.info("\n[forgot-password] SMTP not configured — dev reset link (do not share):\n", resetLink, "\n");
    //   }
    //   return res.status(200).json(successResponse);
    // }

    try {
      await sendEmail(
         user.email,
        "Reset your password 🔐",
        passwordResetEmail(user.name, resetLink),
      );
    } catch (emailError) {
      console.error("❌ Failed to send reset email:", emailError);
    }

    return res.status(200).json(successResponse);
  } catch (error) {
    return res.status(500).json({ error: "Something went wrong" });
  }
}


//RESET-PASSWORD



export async function resetPassword(req: Request, res: Response) {
  const { token } = req.params as { token: string };
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
      resetToken: null,        // clear token after use — one-time use only
      resetTokenExpiry: null,
    },
  });

  res.json({ message: "Password reset successfully" });
}

export async function googleLogin(req: Request, res: Response) {
  const raw = req.body as Record<string, unknown>;
  const email = String(raw["email"] ?? "google.guest@airbnb.local").trim().toLowerCase();
  const name = String(raw["name"] ?? "Google Guest").trim();

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      isActive: true,
    },
    create: {
      name,
      email,
      username: `google_${crypto.randomBytes(4).toString("hex")}`,
      phone: "0000000000",
      password: await bcrypt.hash(crypto.randomBytes(16).toString("hex"), 10),
      role: "GUEST",
      isActive: true,
    },
  });

  const token = jwt.sign(
    { userId: user.id, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" },
  );

  const { password: _, ...userWithoutPassword } = user;
  res.json({ user: userWithoutPassword, token });
}
