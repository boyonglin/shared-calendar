/**
 * Structured logging utility for server
 *
 * Re-exports logging from shared core to ensure consistency
 * and provides server-specific request context logging.
 */
import type pino from "pino";
import { sharedLogger, logServiceError } from "../../../shared/core/index.js";

// Re-export the shared logger as the main logger
export const logger = sharedLogger;

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
 * Structured error logging helper
 * Uses shared implementation for consistency
 */
export function logError(
  log: pino.Logger,
  error: unknown,
  message: string,
  context?: Record<string, unknown>,
) {
  logServiceError(log, error, message, context);
}

export default logger;
