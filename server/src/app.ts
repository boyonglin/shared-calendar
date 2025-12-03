/**
 * Express Application Configuration
 *
 * This file exports the configured Express app without starting the server.
 * This allows the same app to be used in both:
 * - Local development (server/src/index.ts calls app.listen())
 * - Vercel serverless (api/index.ts imports and uses the app directly)
 *
 * "Write Once, Run Everywhere" architecture - add routes once,
 * they automatically work in both environments.
 */
import express from "express";
import type { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.js";
import apiRoutes from "./routes/index.js";
import logger from "./utils/logger.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

// Import shared core
import { healthCheck } from "../../shared/core/index.js";

// Environment configuration
const CLIENT_URL =
  process.env.CLIENT_URL || "https://shared-calendar-vibe.vercel.app";

const app = express();

// Trust proxy for correct client IP/protocol behind reverse proxies
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

// Routes
app.use("/api/auth", authRoutes);
app.use("/api", apiRoutes);

// Health check
app.get("/api/health", async (_req, res) => {
  const dbHealthy = await healthCheck();
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

// API root endpoint
app.get("/api", (_req, res) => {
  res.json({
    message: "Shared Calendar API",
    version: "1.0.0",
    endpoints: [
      "GET /api/health",
      "GET /api/auth/google",
      "GET /api/auth/google/callback",
      "GET /api/auth/me",
      "GET /api/auth/outlook",
      "GET /api/auth/outlook/callback",
      "POST /api/auth/exchange",
      "POST /api/auth/icloud",
      "DELETE /api/auth/revoke",
      "GET /api/users/:id",
      "GET /api/calendar/all-events/:userId",
      "GET /api/calendar/events-stream/:userId (SSE)",
      "POST /api/calendar/events",
      "GET /api/calendar/icloud/status",
      "DELETE /api/calendar/icloud/:userId",
      "GET /api/calendar/outlook/status",
      "DELETE /api/calendar/outlook/:userId",
      "GET /api/friends",
      "POST /api/friends",
      "DELETE /api/friends/:friendId",
      "GET /api/friends/requests/incoming",
      "POST /api/friends/sync-pending",
      "POST /api/friends/:friendId/accept",
      "POST /api/friends/:friendId/reject",
      "GET /api/friends/:friendId/events",
      "POST /api/ai/draft-invitation",
      "GET /api/privacy",
    ],
  });
});

// Privacy policy redirect
app.get("/api/privacy", (_req, res) => {
  res.redirect(
    301,
    "https://www.privacypolicies.com/live/206e7238-acb3-4701-ab5c-c102a087fd1a",
  );
});

// 404 handler for unmatched routes
app.use(notFoundHandler);

// Global error handler - must be last middleware
app.use(errorHandler);

export { app, logger };
