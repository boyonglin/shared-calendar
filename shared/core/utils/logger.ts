/**
 * Shared Logger Utility
 *
 * Provides consistent logging across the shared core services.
 * Uses pino for structured logging with environment-aware configuration.
 */
import pino from "pino";

const isDevelopment = process.env.NODE_ENV !== "production";

/**
 * Shared logger instance for use in shared/core services
 * - JSON output in production for log aggregation
 * - Pretty-printed output in development for readability
 */
export const sharedLogger = pino({
  level: isDevelopment ? "debug" : "info",
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
    env: process.env.NODE_ENV || "development",
    module: "shared-core",
  },
  // Redact sensitive fields
  redact: {
    paths: [
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
 * Create a child logger with service context
 */
export function createServiceLogger(serviceName: string) {
  return sharedLogger.child({ service: serviceName });
}

/**
 * Structured error logging helper for shared services
 */
export function logServiceError(
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

export default sharedLogger;
