/**
 * Vercel-optimized Express Application
 *
 * This is a simplified version of the Express server for Vercel serverless deployment.
 * It removes the server.listen() call and exports the app for use as a serverless function.
 */
import "dotenv/config";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/auth";
import apiRoutes from "./routes/index";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { calendarAccountRepository } from "./repositories";
import {
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_AUTH_MAX_REQUESTS,
} from "./constants";

const app = express();

// Trust proxy for rate limiting behind reverse proxy (important for Vercel)
app.set("trust proxy", 1);

// Request ID middleware for request tracking
let requestCounter = 0;
app.use((req: Request, _res: Response, next: NextFunction) => {
  const requestId = `${Date.now()}-${++requestCounter}`;
  (req as Request & { requestId: string }).requestId = requestId;
  next();
});

// Security middleware (with relaxed settings for serverless)
app.use(
  helmet({
    contentSecurityPolicy: false, // Let Vercel handle this
  }),
);

// Rate limiting - general API limiter
const generalLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX_REQUESTS,
  message: { error: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  // Use memory store for serverless (stateless between invocations)
  // For production, consider using a Redis-based store
});

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_AUTH_MAX_REQUESTS,
  message: {
    error: "Too many authentication attempts, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply general rate limiter
app.use(generalLimiter);

// Cookie parser middleware
app.use(cookieParser());

// CORS middleware - allow multiple origins for development and production
const allowedOrigins = [
  env.CLIENT_URL,
  "http://localhost:5173",
  "http://localhost:3000",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      // In production, you might want to be stricter
      if (process.env.NODE_ENV !== "production") {
        return callback(null, true);
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);

// Body parser with size limit
app.use(express.json({ limit: "10kb" }));

// Routes with specific rate limiters
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api", apiRoutes);

// Health check
app.get("/api/health", (_req, res) => {
  const dbHealthy = calendarAccountRepository.healthCheck();
  const status = dbHealthy ? "ok" : "degraded";
  const statusCode = dbHealthy ? 200 : 503;

  res.status(statusCode).json({
    status,
    timestamp: new Date().toISOString(),
    environment: "vercel",
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
    environment: "vercel",
  });
});

// 404 handler for unmatched routes
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

export default app;
