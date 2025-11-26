import "dotenv/config"; // Load environment variables before other imports
import express from "express";
import type { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/auth";
import apiRoutes from "./routes/index";
import { env } from "./config/env";
import logger, { createRequestLogger, logError } from "./utils/logger";
import "./db"; // Initialize database

const app = express();
const PORT = env.PORT;
const CLIENT_URL = env.CLIENT_URL;

// Request ID middleware for request tracking
let requestCounter = 0;
app.use((req: Request, _res: Response, next: NextFunction) => {
  const requestId = `${Date.now()}-${++requestCounter}`;
  (req as Request & { requestId: string }).requestId = requestId;
  next();
});

// Security middleware
app.use(helmet());

// Rate limiting - general API limiter
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limit for auth endpoints to prevent brute force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 auth requests per windowMs
  message: {
    error: "Too many authentication attempts, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply general rate limiter to all requests
app.use(generalLimiter);

// Cookie parser middleware
app.use(cookieParser());

// CORS middleware
app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  }),
);

// Body parser with size limit to prevent large payload attacks
app.use(express.json({ limit: "10kb" }));

// Routes with specific rate limiters
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api", apiRoutes);

// Health check (excluded from rate limiting for monitoring)
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Root endpoint
app.get("/", (_req, res) => {
  res.json({
    message: "Shared Calendar API",
    status: "running",
  });
});

// 404 handler for unmatched routes
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Global error handler - must be last middleware
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  const requestId = (req as Request & { requestId?: string }).requestId;
  const log = createRequestLogger({
    requestId,
    method: req.method,
    path: req.path,
  });

  logError(log, err, "Unhandled error");

  // Don't leak error details in production
  const errorMessage =
    env.NODE_ENV === "production"
      ? "Internal server error"
      : err.message || "Internal server error";

  res.status(500).json({ error: errorMessage });
});

// Graceful shutdown handling
const server = app.listen(PORT, () => {
  logger.info({ port: PORT, environment: env.NODE_ENV }, "🚀 Server started");
});

// Handle graceful shutdown
const shutdown = (signal: string) => {
  logger.info({ signal }, "Shutdown signal received, closing server...");
  server.close(() => {
    logger.info("✅ Server closed gracefully");
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  globalThis.setTimeout(() => {
    logger.error("⚠️ Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
