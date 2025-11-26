/**
 * Custom error classes for consistent error handling
 *
 * Provides typed errors that can be caught and processed
 * by the global error handler to return appropriate HTTP responses.
 */

/**
 * Base application error class
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    isOperational = true,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.name = this.constructor.name;

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert to a safe JSON response (hides internal details)
   */
  toJSON() {
    return {
      error: this.message,
      code: this.code,
    };
  }
}

/**
 * 400 Bad Request - Invalid input or parameters
 */
export class BadRequestError extends AppError {
  constructor(message = "Bad request", code = "BAD_REQUEST") {
    super(message, 400, code);
  }
}

/**
 * 401 Unauthorized - Authentication required or failed
 */
export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized", code = "UNAUTHORIZED") {
    super(message, 401, code);
  }
}

/**
 * 401 - Token expired
 */
export class TokenExpiredError extends UnauthorizedError {
  constructor(message = "Token expired") {
    super(message, "TOKEN_EXPIRED");
  }
}

/**
 * 403 Forbidden - User doesn't have permission
 */
export class ForbiddenError extends AppError {
  constructor(message = "Forbidden", code = "FORBIDDEN") {
    super(message, 403, code);
  }
}

/**
 * 404 Not Found - Resource doesn't exist
 */
export class NotFoundError extends AppError {
  constructor(message = "Not found", code = "NOT_FOUND") {
    super(message, 404, code);
  }
}

/**
 * 409 Conflict - Resource already exists or state conflict
 */
export class ConflictError extends AppError {
  constructor(message = "Conflict", code = "CONFLICT") {
    super(message, 409, code);
  }
}

/**
 * 422 Unprocessable Entity - Validation failed
 */
export class ValidationError extends AppError {
  public readonly errors: Array<{ field: string; message: string }>;

  constructor(
    message = "Validation failed",
    errors: Array<{ field: string; message: string }> = [],
  ) {
    super(message, 422, "VALIDATION_ERROR");
    this.errors = errors;
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      errors: this.errors,
    };
  }
}

/**
 * 429 Too Many Requests - Rate limit exceeded
 */
export class RateLimitError extends AppError {
  constructor(message = "Too many requests, please try again later") {
    super(message, 429, "RATE_LIMIT_EXCEEDED");
  }
}

/**
 * 500 Internal Server Error - Unexpected error
 */
export class InternalError extends AppError {
  constructor(message = "Internal server error", code = "INTERNAL_ERROR") {
    super(message, 500, code, false);
  }
}

/**
 * 501 Not Implemented - Feature not yet available
 */
export class NotImplementedError extends AppError {
  constructor(message = "Not implemented", code = "NOT_IMPLEMENTED") {
    super(message, 501, code);
  }
}

/**
 * 503 Service Unavailable - Dependency is down
 */
export class ServiceUnavailableError extends AppError {
  constructor(message = "Service unavailable", code = "SERVICE_UNAVAILABLE") {
    super(message, 503, code);
  }
}

/**
 * Type guard to check if an error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
