import "dotenv/config";
import compression from "compression";
import express from "express";
import userRoutes from "./routes/users.route.js";
import listingRoutes from "./routes/listings.route.js";
import bookingRoutes from "./routes/bookings.route.js";
import authRoutes from "./routes/auth.routes.js";
import aiRoutes from "./routes/ai.routes.js";
import reviewRoutes from "./routes/review.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import { connectDB } from "./lib/prisma.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { logger } from "./lib/logger.js";
import { setupSwagger } from "./config/swagger.js";
import { generalLimiter, strictLimiter } from "./middleware/rateLimiter.js";
const app = express();
setupSwagger(app);
const PORT = parseInt(process.env["PORT"]) || 3000;
app.use(express.json());
app.use(compression());
app.use(generalLimiter);
app.use((req, res, next) => {
    if (req.method === "POST") {
        return strictLimiter(req, res, next);
    }
    next();
});
// connect routes
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/listings", listingRoutes);
app.use("/api/v1/bookings", bookingRoutes);
app.use("/api/v1", reviewRoutes);
app.use("/api/v1/upload", uploadRoutes);
app.use("/api/v1/ai", aiRoutes);
// Error handling middleware (must be last)
app.use(errorHandler);
async function main() {
    try {
        await connectDB();
        logger.success("Database connected successfully");
        app.listen(PORT, () => {
            logger.success(`Server running at: http://localhost:${PORT}`);
        });
    }
    catch (error) {
        logger.error("Failed to start server:", error);
        process.exit(1);
    }
}
main();
