// IMPORTANT: Import env first to ensure dotenv is loaded before any other modules
// that read process.env at module level (e.g., googleAuth.ts)
import { env } from "./config/env";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/auth";
import apiRoutes from "./routes/index";
import logger from "./utils/logger";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { calendarAccountRepository } from "./repositories";
import {
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_AUTH_MAX_REQUESTS,
  GRACEFUL_SHUTDOWN_TIMEOUT_MS,
} from "./constants";
import { getDb } from "./db"; // Initialize database on startup

// Initialize database connection
getDb().then(() => {
  logger.info("Database connection established");
}).catch((err) => {
  logger.error({ err }, "Failed to initialize database");
  process.exit(1);
});

const app = express();
const PORT = env.PORT;
const CLIENT_URL = env.CLIENT_URL;

// Trust proxy for rate limiting behind reverse proxy
app.set("trust proxy", 1);

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
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX_REQUESTS,
  message: { error: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limit for auth endpoints to prevent brute force
const authLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_AUTH_MAX_REQUESTS,
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
app.get("/api/health", async (_req, res) => {
  const dbHealthy = await calendarAccountRepository.healthCheck();
  const status = dbHealthy ? "ok" : "degraded";
  const statusCode = dbHealthy ? 200 : 503;

  res.status(statusCode).json({
    status,
    timestamp: new Date().toISOString(),
    checks: {
      database: dbHealthy ? "ok" : "error",
    },
  });
});

// Root endpoint
app.get("/", (_req, res) => {
  res.json({
    message: "Shared Calendar API",
    version: "1.0.0",
    status: "running",
  });
});

// 404 handler for unmatched routes
app.use(notFoundHandler);

// Global error handler - must be last middleware
app.use(errorHandler);

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

  // Force shutdown after timeout
  globalThis.setTimeout(() => {
    logger.error("⚠️ Forced shutdown after timeout");
    process.exit(1);
  }, GRACEFUL_SHUTDOWN_TIMEOUT_MS);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
