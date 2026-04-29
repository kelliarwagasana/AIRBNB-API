import { logger } from "../lib/logger.js";
import { Prisma } from "@prisma/client";
export const errorHandler = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    // Log the error with details
    logger.error(message, {
        path: req.path,
        method: req.method,
        statusCode,
        stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
    // Handle Prisma-specific errors
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
        handlePrismaError(err, res);
        return;
    }
    // Handle Prisma validation errors
    if (err instanceof Prisma.PrismaClientValidationError) {
        res.status(400).json({
            error: "Validation error",
            message: err.message,
        });
        return;
    }
    // Send appropriate response based on environment
    if (process.env.NODE_ENV === "development") {
        res.status(statusCode).json({
            error: message,
            statusCode,
            stack: err.stack,
        });
    }
    else {
        res.status(statusCode).json({
            error: statusCode === 500 ? "Something went wrong" : message,
        });
    }
};
const handlePrismaError = (err, res) => {
    switch (err.code) {
        case "P2002":
            // Unique constraint violation
            logger.warn("Unique constraint violation", { meta: err.meta });
            res.status(409).json({
                error: "A record with this value already exists",
            });
            break;
        case "P2025":
            // Record not found
            logger.warn("Record not found", { meta: err.meta });
            res.status(404).json({
                error: "Record not found",
            });
            break;
        case "P2003":
            // Foreign key constraint violation
            logger.warn("Foreign key constraint violation", { meta: err.meta });
            res.status(400).json({
                error: "Invalid reference to related record",
            });
            break;
        case "P2000":
            // Column constraint violation
            logger.warn("Column constraint violation", { meta: err.meta });
            res.status(400).json({
                error: "Value too long for column constraint",
            });
            break;
        case "P2001":
            // Search or update would return more than one row
            logger.warn("Operation would affect multiple rows", { meta: err.meta });
            res.status(400).json({
                error: "Operation would affect multiple records",
            });
            break;
        default:
            // Unknown Prisma error
            logger.error("Unknown Prisma error", { code: err.code, meta: err.meta });
            res.status(500).json({
                error: "Database operation failed",
            });
    }
};
// Async wrapper to catch errors in route handlers
export const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
// Create custom operational errors
export class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}
export class NotFoundError extends AppError {
    constructor(message = "Resource not found") {
        super(message, 404);
    }
}
export class ValidationError extends AppError {
    constructor(message = "Validation failed") {
        super(message, 400);
    }
}
export class UnauthorizedError extends AppError {
    constructor(message = "Unauthorized") {
        super(message, 401);
    }
}
export class ConflictError extends AppError {
    constructor(message = "Resource already exists") {
        super(message, 409);
    }
}
