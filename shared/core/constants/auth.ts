/**
 * Authentication Constants
 */
import { ONE_MINUTE_MS, ONE_DAY_MS } from "./time.js";

// =============================================================================
// Auth Code & JWT
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
// Cookie Configuration
// =============================================================================

/**
 * Standard cookie sameSite setting for authentication cookies
 * Using "lax" to support OAuth redirect flows while still providing
 * reasonable CSRF protection
 */
export const COOKIE_SAME_SITE = "lax" as const;

/**
 * Cookie names used across the application
 */
export const COOKIE_NAMES = {
  JWT_TOKEN: "token",
  OUTLOOK_AUTH_STATE: "outlook_auth_state",
} as const;

// =============================================================================
// Google OAuth
// =============================================================================

/** Google OAuth scopes */
export const GOOGLE_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
];

/** Google token revocation endpoint */
export const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";

// =============================================================================
// External Services
// =============================================================================

/** OneCal API base URL */
export const ONECAL_API_BASE = "https://api.onecalunified.com/api/v1";

/** iCloud CalDAV server URL */
export const ICLOUD_CALDAV_URL = "https://caldav.icloud.com";
