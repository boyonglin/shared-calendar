// Time constants (in milliseconds)
export const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000; // 5 minutes
export const TOKEN_EXPIRY_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days (match JWT cookie expiry)

// Google Sign-in button icon dimensions
export const GOOGLE_ICON_SIZE = 18;
export const GOOGLE_ICON_VIEWBOX_SIZE = 48;

// LocalStorage keys
export const STORAGE_KEYS = {
  USER: "google_user",
  TOKEN_EXPIRY: "google_token_expiry",
  CALENDAR_EVENTS: "google_calendar_events",
} as const;
