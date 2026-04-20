import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/apiError.js";
import { logger } from "../utils/logger.js";
import mongoose from "mongoose";

const isDev = process.env.NODE_ENV !== "production";

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  logger.error(`${req.method} ${req.originalUrl} → ${err.message}`, {
    stack: err.stack,
    ...(isDev && { body: req.body, params: req.params }),
  });

  // AppError (operational)
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(isDev && { stack: err.stack }),
    });
    return;
  }

  // Mongoose validation error
  if (err instanceof mongoose.Error.ValidationError) {
    const messages = Object.values(err.errors).map((e) => e.message);
    res.status(400).json({
      success: false,
      message: "Validation error",
      errors: messages,
      ...(isDev && { stack: err.stack }),
    });
    return;
  }

  // Mongoose duplicate key
  if (err.name === "MongoServerError" && (err as any).code === 11000) {
    res.status(409).json({
      success: false,
      message: "Duplicate value. This resource already exists.",
      ...(isDev && { detail: (err as any).keyValue, stack: err.stack }),
    });
    return;
  }

  // JWT errors
  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
    return;
  }

  // Default 500
  res.status(500).json({
    success: false,
    message: isDev ? err.message : "Internal server error",
    ...(isDev && { stack: err.stack }),
  });
};
