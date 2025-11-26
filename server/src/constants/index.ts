/**
 * Server-side constants
 *
 * Centralized configuration values for the server application.
 * Using constants instead of magic numbers improves maintainability
 * and makes the codebase more self-documenting.
 */

// =============================================================================
// Time Constants (in milliseconds)
// =============================================================================

/** 1 second in milliseconds */
export const ONE_SECOND_MS = 1000;

/** 1 minute in milliseconds */
export const ONE_MINUTE_MS = 60 * ONE_SECOND_MS;

/** 1 hour in milliseconds */
export const ONE_HOUR_MS = 60 * ONE_MINUTE_MS;

/** 1 day in milliseconds */
export const ONE_DAY_MS = 24 * ONE_HOUR_MS;

/** 1 week in milliseconds */
export const ONE_WEEK_MS = 7 * ONE_DAY_MS;

// =============================================================================
// Rate Limiting
// =============================================================================

/** Rate limit window duration (15 minutes) */
export const RATE_LIMIT_WINDOW_MS = 15 * ONE_MINUTE_MS;

/** Maximum requests per IP in the rate limit window */
export const RATE_LIMIT_MAX_REQUESTS = 100;

/** Maximum authentication requests per IP in the rate limit window */
export const RATE_LIMIT_AUTH_MAX_REQUESTS = 10;

// =============================================================================
// Authentication
// =============================================================================

/** Auth exchange code expiration time (5 minutes) */
export const AUTH_CODE_EXPIRATION_MS = 5 * ONE_MINUTE_MS;

/** Auth code cleanup interval (1 minute) */
export const AUTH_CODE_CLEANUP_INTERVAL_MS = ONE_MINUTE_MS;

/** JWT cookie max age (30 days) */
export const JWT_COOKIE_MAX_AGE_MS = 30 * ONE_DAY_MS;

/** Outlook auth temp cookie max age (10 minutes) */
export const OUTLOOK_AUTH_COOKIE_MAX_AGE_MS = 10 * ONE_MINUTE_MS;

// =============================================================================
// Calendar
// =============================================================================

/** Default calendar event fetch range (4 weeks) */
export const DEFAULT_EVENT_FETCH_WEEKS = 4;

/** Default calendar event fetch range in milliseconds */
export const DEFAULT_EVENT_FETCH_RANGE_MS =
  DEFAULT_EVENT_FETCH_WEEKS * ONE_WEEK_MS;

// =============================================================================
// Server
// =============================================================================

/** Graceful shutdown timeout (10 seconds) */
export const GRACEFUL_SHUTDOWN_TIMEOUT_MS = 10 * ONE_SECOND_MS;

// =============================================================================
// AI Service
// =============================================================================

/** Maximum input length for AI queries */
export const AI_MAX_INPUT_LENGTH = 1000;

/** Maximum attendee name length in AI responses */
export const AI_MAX_ATTENDEE_LENGTH = 100;

// =============================================================================
// UI Constants
// =============================================================================

/**
 * Colors for friend display
 * Used to assign consistent colors to friends based on their email hash
 */
export const FRIEND_COLORS = [
  "#10b981", // green
  "#f59e0b", // amber
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
  "#6366f1", // indigo
  "#84cc16", // lime
] as const;

export type FriendColor = (typeof FRIEND_COLORS)[number];
