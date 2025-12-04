/**
 * Client-side API error classes
 *
 * Typed errors for handling API responses consistently across the client.
 * Mirrors server error structure for consistency.
 */

/**
 * Standard API error response from server
 */
export interface ApiErrorResponse {
  error: string;
  code?: string;
  errors?: Array<{ field: string; message: string }>;
}

/**
 * Base client API error class
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode: number, code: string = "API_ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = this.constructor.name;
  }

  /**
   * Check if this is a specific error type by code
   */
  is(code: string): boolean {
    return this.code === code;
  }
}

/**
 * 400 Bad Request - Invalid input or parameters
 */
export class BadRequestError extends ApiError {
  constructor(message = "Bad request", code = "BAD_REQUEST") {
    super(message, 400, code);
  }
}

/**
 * 401 Unauthorized - Authentication required or failed
 */
export class UnauthorizedError extends ApiError {
  constructor(message = "Unauthorized", code = "UNAUTHORIZED") {
    super(message, 401, code);
  }
}

/**
 * 401 - Token expired (specific unauthorized case)
 */
export class TokenExpiredError extends UnauthorizedError {
  constructor(message = "Session expired") {
    super(message, "TOKEN_EXPIRED");
  }
}

/**
 * 403 Forbidden - User doesn't have permission
 */
export class ForbiddenError extends ApiError {
  constructor(message = "Forbidden", code = "FORBIDDEN") {
    super(message, 403, code);
  }
}

/**
 * 404 Not Found - Resource doesn't exist
 */
export class NotFoundError extends ApiError {
  constructor(message = "Not found", code = "NOT_FOUND") {
    super(message, 404, code);
  }
}

/**
 * 409 Conflict - Resource already exists or state conflict
 */
export class ConflictError extends ApiError {
  constructor(message = "Conflict", code = "CONFLICT") {
    super(message, 409, code);
  }
}

/**
 * 422 Validation Error - Input validation failed
 */
export class ValidationError extends ApiError {
  public readonly errors: Array<{ field: string; message: string }>;

  constructor(
    message = "Validation failed",
    errors: Array<{ field: string; message: string }> = [],
  ) {
    super(message, 422, "VALIDATION_ERROR");
    this.errors = errors;
  }
}

/**
 * Network error - Request failed to reach server
 */
export class NetworkError extends ApiError {
  constructor(message = "Network error") {
    super(message, 0, "NETWORK_ERROR");
  }
}

/**
 * Type guard to check if an error is an ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Type guard to check if error is an unauthorized error
 */
export function isUnauthorizedError(
  error: unknown,
): error is UnauthorizedError {
  return error instanceof UnauthorizedError;
}

/**
 * Type guard to check if error is a token expired error
 */
export function isTokenExpiredError(
  error: unknown,
): error is TokenExpiredError {
  return error instanceof TokenExpiredError;
}

/**
 * Create appropriate ApiError from HTTP response
 */
export function createApiErrorFromResponse(
  statusCode: number,
  data: ApiErrorResponse,
): ApiError {
  const message = data.error || "Request failed";
  const code = data.code;

  switch (statusCode) {
    case 400:
      return new BadRequestError(message, code);
    case 401:
      if (code === "TOKEN_EXPIRED") {
        return new TokenExpiredError(message);
      }
      return new UnauthorizedError(message, code);
    case 403:
      return new ForbiddenError(message, code);
    case 404:
      return new NotFoundError(message, code);
    case 409:
      return new ConflictError(message, code);
    case 422:
      return new ValidationError(message, data.errors);
    default:
      return new ApiError(message, statusCode, code);
  }
}
