/**
 * LocalStorage Keys
 *
 * Centralized storage key definitions for the client application.
 * Using constants prevents typos and makes refactoring easier.
 */

/**
 * Google authentication related storage keys
 */
export const STORAGE_KEYS = {
  // User session
  USER: "google_user",
  TOKEN_EXPIRY: "google_token_expiry",
  CALENDAR_EVENTS: "google_calendar_events",

  // UI preferences
  DARK_MODE: "darkMode",
  CALENDAR_START_HOUR: "calendar_start_hour",
  CALENDAR_END_HOUR: "calendar_end_hour",

  // API keys
  GEMINI_API_KEY: "gemini_api_key",
  GEMINI_API_KEY_VALID: "gemini_api_key_valid",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

/**
 * Calendar hour defaults
 */
export const CALENDAR_DEFAULTS = {
  START_HOUR: 6,
  END_HOUR: 22,
} as const;
