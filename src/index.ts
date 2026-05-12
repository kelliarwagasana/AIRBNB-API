import "dotenv/config";
import compression from "compression";
import express from "express";
import { connectDB } from "./lib/prisma.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { logger } from "./lib/logger.js";
import { setupSwagger } from "./config/swagger.js"; 
import { generalLimiter, strictLimiter } from "./middleware/rateLimiter.js";
import v1Router from "./routes/v1/index.js";
import { Request, Response } from "express";

const app = express();
setupSwagger(app);
const PORT = parseInt(process.env["PORT"] as string) || 3000;

app.use(express.json());
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
