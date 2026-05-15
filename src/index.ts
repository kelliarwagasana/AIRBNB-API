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

const PORT = Number.parseInt(process.env["PORT"] ?? "", 10) || 3000;

const app = express();
setupSwagger(app, PORT);

const corsOrigin = process.env["CORS_ORIGIN"] ?? "*";
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", corsOrigin);
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json({ limit: "12mb" }));
app.use(compression());
app.use(generalLimiter);
app.use((req, res, next) => {
  if (req.method === "POST") {
    return strictLimiter(req, res, next);
  }

  next();
});
app.get("/health", (req: Request, res: Response) => {
  res.json({ 
    status: "ok", 
    uptime: process.uptime(), 
    timestamp: new Date() 
  });
});

// connect routes
app.use("/api/v1", v1Router);

// Error handling middleware (must be last)
app.use(errorHandler);

async function main() {
  try {
    await connectDB();
    clearCacheByPrefix("listings:list:");
    logger.success("Database connected successfully");
    
    app.listen(PORT, () => {
      logger.success(`Server running at: http://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

main();
