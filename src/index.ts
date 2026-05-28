import "dotenv/config";
import compression from "compression";
import express from "express";
import { connectDB } from "./lib/prisma.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { logger } from "./lib/logger.js";
import { setupSwagger } from "./config/swagger.js";
import { generalLimiter, strictLimiter } from "./middleware/rateLimiter.js";
import { clearCacheByPrefix } from "./config/cache.js";
import v1Router from "./routes/v1/index.js";
import { Request, Response } from "express";

const PORT = Number.parseInt(process.env["PORT"] ?? "", 10) || 4000;
const isProduction = process.env["NODE_ENV"] === "production";

const DEPLOYED_FRONTEND_ORIGINS = [
  "https://airbnbkelia.vercel.app",
];

const DEV_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  "http://localhost:5175",
  "http://127.0.0.1:5175",
  "http://localhost:5176",
  "http://127.0.0.1:5176",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, "");
}

function getAllowedOrigins(): Set<string> {
  const raw = process.env["CORS_ORIGIN"]?.trim();
  const fromEnv = raw
    ? raw.split(",").map(normalizeOrigin).filter(Boolean)
    : [];

  if (isProduction) {
    return new Set([...DEPLOYED_FRONTEND_ORIGINS, ...fromEnv]);
  }

  return new Set([...DEPLOYED_FRONTEND_ORIGINS, ...DEV_ORIGINS, ...fromEnv]);
}

const allowedOrigins = getAllowedOrigins();

const app = express();

app.get("/", (req, res)=>{
  res.send("Api Working")
})

app.use((req, res, next) => {
  const requestOrigin = req.headers.origin;

  if (requestOrigin) {
    const normalized = normalizeOrigin(requestOrigin);
    if (allowedOrigins.has(normalized)) {
      res.setHeader("Access-Control-Allow-Origin", normalized);
      res.setHeader("Vary", "Origin");
    }
  }

  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Accept",
  );
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

setupSwagger(app, PORT);

app.use(express.json({ limit: "12mb" }));
app.use(compression());
app.use(generalLimiter);
app.use((req, res, next) => {
  if (req.method === "POST") {
    return strictLimiter(req, res, next);
  }

  next();
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date(),
  });
});

app.use("/api/v1", v1Router);

app.use(errorHandler);

async function main() {
  try {
    await connectDB();
    clearCacheByPrefix("listings:list:");
    logger.success("Database connected successfully");
    logger.info(`CORS allowed origins: ${[...allowedOrigins].join(", ")}`);

    app.listen(PORT, () => {
      logger.success(`Server running at: http://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

main();
