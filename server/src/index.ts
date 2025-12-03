/**
 * Local Development Server Entry Point
 *
 * This file imports the Express app and starts the server.
 * All app configuration is in app.ts for sharing with Vercel.
 */

// IMPORTANT: Import env first to ensure dotenv is loaded before any other modules
import { env } from "./config/env";
import { app, logger } from "./app";
import {
  ensureDbInitialized,
  GRACEFUL_SHUTDOWN_TIMEOUT_MS,
} from "../../shared/core";

// Initialize database connection
ensureDbInitialized()
  .then(() => {
    logger.info("Database connection established");
  })
  .catch((err) => {
    logger.error({ err }, "Failed to initialize database");
    process.exit(1);
  });

const PORT = env.PORT;

// Start server
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
