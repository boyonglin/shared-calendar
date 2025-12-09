/**
 * Calendar Constants
 */

/** Calendar view: days in a week */
export const DAYS_IN_WEEK = 7;

/** Default hour to scroll to when current time is not visible (9 AM) */
export const DEFAULT_SCROLL_HOUR = 9;

/** Calendar fetch: days before current week start (2 weeks) */
export const CALENDAR_FETCH_DAYS_BEFORE = 14;

/** Calendar fetch: days after current week start (3 weeks) */
export const CALENDAR_FETCH_DAYS_AFTER = 21;

/** Default API event fetch range in days (4 weeks = 28 days) */
export const DEFAULT_API_FETCH_DAYS = 28;

// =============================================================================
// SSE (Server-Sent Events)
// =============================================================================

/** SSE connection timeout in milliseconds (default: 30 seconds) */
export const SSE_TIMEOUT_MS = 30_000;

/** SSE heartbeat interval in milliseconds (15 seconds) */
export const SSE_HEARTBEAT_INTERVAL_MS = 15_000;
