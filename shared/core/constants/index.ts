/**
 * Shared Constants
 *
 * Centralized configuration values used across both local server and Vercel deployment.
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

/** Google OAuth scopes */
export const GOOGLE_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
];

/** Google token revocation endpoint */
export const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";

/** OneCal API base URL */
export const ONECAL_API_BASE = "https://api.onecalunified.com/api/v1";

/** iCloud CalDAV server URL */
export const ICLOUD_CALDAV_URL = "https://caldav.icloud.com";

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

/** Maximum number of attendees in AI requests */
export const AI_MAX_ATTENDEES = 50;

/** Valid tones for AI invitation generation */
export const VALID_TONES = ["professional", "casual", "friendly"] as const;
export type Tone = (typeof VALID_TONES)[number];

// =============================================================================
// Encryption
// =============================================================================

/** IV length for AES-256-CBC encryption */
export const ENCRYPTION_IV_LENGTH = 16;

// =============================================================================
// UI Constants
// =============================================================================

/**
 * Colors for friend display
 * Used to assign consistent colors to friends based on their email hash
 */
export const FRIEND_COLORS = [
  "#EF4444",
  "#F97316",
  "#F59E0B",
  "#EAB308",
  "#84CC16",
  "#22C55E",
  "#10B981",
  "#14B8A6",
  "#06B6D4",
  "#0EA5E9",
  "#3B82F6",
  "#6366F1",
  "#8B5CF6",
  "#A855F7",
  "#D946EF",
  "#EC4899",
  "#F43F5E",
] as const;

export type FriendColor = (typeof FRIEND_COLORS)[number];
