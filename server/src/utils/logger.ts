/**
 * Structured logging utility using pino
 *
 * Provides consistent, structured logging across the server with:
 * - JSON output in production for log aggregation
 * - Pretty-printed output in development for readability
 * - Request context (requestId, userId) propagation
 * - Performance timing helpers
 */
import pino from "pino";
import { env } from "../config/env";

const isDevelopment = env.NODE_ENV !== "production";

// Base logger configuration
export const logger = pino({
  level: env.LOG_LEVEL || (isDevelopment ? "debug" : "info"),
  // Use pino-pretty in development for readable logs
  transport: isDevelopment
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      }
    : undefined,
  // Add base fields to all logs
  base: {
    env: env.NODE_ENV,
  },
  // Redact sensitive fields
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "password",
      "token",
      "accessToken",
      "refreshToken",
      "apiKey",
      "*.password",
      "*.token",
      "*.accessToken",
      "*.refreshToken",
    ],
    censor: "[REDACTED]",
  },
});

/**
 * Create a child logger with request context
 */
export function createRequestLogger(context: {
  requestId?: string;
  userId?: string;
  method?: string;
  path?: string;
}) {
  return logger.child(context);
}

/**
 * Log levels explained:
 * - fatal: System is unusable, immediate action required
 * - error: Error condition that should be investigated
 * - warn: Warning condition, not an error but notable
 * - info: Informational messages (default in production)
 * - debug: Debug information (default in development)
 * - trace: Very detailed tracing information
 */

/**
 * Structured error logging helper
 * Extracts useful error properties for structured logging
 */
export function logError(
  log: pino.Logger,
  error: unknown,
  message: string,
  context?: Record<string, unknown>,
) {
  const errorInfo =
    error instanceof Error
      ? {
          errorName: error.name,
          errorMessage: error.message,
          stack: isDevelopment ? error.stack : undefined,
        }
      : { errorMessage: String(error) };

  log.error({ ...errorInfo, ...context }, message);
}

export default logger;
