/**
 * Vercel-optimized Express Application
 *
 * This is a simplified version of the Express server for Vercel serverless deployment.
 * It removes the server.listen() call and exports the app for use as a serverless function.
 *
 * NOTE: This version uses Turso (async) for database operations.
 * Routes that require database access must use async repositories.
 */
import "dotenv/config";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { calendarAccountRepositoryAsync } from "./repositories/calendarAccountRepositoryAsync";
import { RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS } from "./constants";

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
});

// Apply general rate limiter
app.use(generalLimiter);

// Cookie parser middleware
app.use(cookieParser());

// CORS middleware - allow all origins for now (to be tightened in production)
app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);

// Body parser with size limit
app.use(express.json({ limit: "10kb" }));

// Health check - This is the primary endpoint for verifying the API works
app.get("/api/health", async (_req: Request, res: Response) => {
  try {
    const dbHealthy = await calendarAccountRepositoryAsync.healthCheck();
    const status = dbHealthy ? "ok" : "degraded";
    const statusCode = dbHealthy ? 200 : 503;

    res.status(statusCode).json({
      status,
      timestamp: new Date().toISOString(),
      environment: "vercel",
      node_version: process.version,
      checks: {
        database: dbHealthy ? "ok" : "error",
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      timestamp: new Date().toISOString(),
      environment: "vercel",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Root endpoint
app.get("/api", (_req: Request, res: Response) => {
  res.json({
    message: "Shared Calendar API",
    version: "1.0.0",
    status: "running",
    environment: "vercel",
    endpoints: ["/api/health"],
  });
});

// Catch-all for undefined routes
app.use("/api/*", (_req: Request, res: Response) => {
  res.status(404).json({
    error: "Not found",
    message: "The requested API endpoint does not exist",
  });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: err.message,
  });
});

export default app;
