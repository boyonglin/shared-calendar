/**
 * Centralized error handling middleware
 *
 * Catches all errors and returns appropriate HTTP responses
 * with consistent error format.
 */
import type { Request, Response, NextFunction } from "express";
import { isAppError } from "../utils/errors";
import { createRequestLogger, logError } from "../utils/logger";
import { env } from "../config/env";

interface ErrorResponse {
  error: string;
  code?: string;
  errors?: Array<{ field: string; message: string }>;
  stack?: string;
}

/**
 * Global error handler middleware
 * Must be registered last in the middleware chain
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = (req as Request & { requestId?: string }).requestId;
  const log = createRequestLogger({
    requestId,
    method: req.method,
    path: req.path,
  });

  // Handle operational errors (expected)
  if (isAppError(err)) {
    // Only log errors at appropriate levels
    if (err.statusCode >= 500) {
      logError(log, err, "Server error");
    } else if (err.statusCode >= 400) {
      log.warn({ statusCode: err.statusCode, code: err.code }, err.message);
    }

    const response: ErrorResponse = err.toJSON();

    // Include stack trace in development
    if (env.NODE_ENV === "development") {
      response.stack = err.stack;
    }

    res.status(err.statusCode).json(response);
    return;
  }

  // Handle unexpected errors
  logError(log, err, "Unhandled error");

  // Don't leak error details in production
  const response: ErrorResponse = {
    error:
      env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message || "Internal server error",
    code: "INTERNAL_ERROR",
  };

  if (env.NODE_ENV === "development") {
    response.stack = err.stack;
  }

  res.status(500).json(response);
}

/**
 * Not found handler for unmatched routes
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: "Not found",
    code: "NOT_FOUND",
    path: req.path,
  });
}
