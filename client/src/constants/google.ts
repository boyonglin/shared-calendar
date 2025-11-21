// Time constants (in milliseconds)
export const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000; // 5 minutes
export const TOKEN_EXPIRY_DURATION_MS = 60 * 60 * 1000; // 1 hour
export const GOOGLE_LOAD_CHECK_INTERVAL_MS = 100;
export const GOOGLE_LOAD_TIMEOUT_MS = 10000; // 10 seconds

// Calendar constants
export const CALENDAR_DAYS_TO_FETCH = 28; // 4 weeks
export const CALENDAR_MAX_RESULTS = 100;

// Week calculation constants
export const MONDAY_OFFSET = 1;
export const SUNDAY_ADJUSTMENT = -6;

// Time setting constants
export const DAY_START_HOUR = 0;
export const DAY_START_MINUTE = 0;
export const DAY_START_SECOND = 0;
export const DAY_START_MILLISECOND = 0;
export const DAY_END_HOUR = 23;
export const DAY_END_MINUTE = 59;
export const DAY_END_SECOND = 59;
export const DAY_END_MILLISECOND = 999;

// Google Sign-in button icon dimensions
export const GOOGLE_ICON_SIZE = 18;
export const GOOGLE_ICON_VIEWBOX_SIZE = 48;

// LocalStorage keys
export const STORAGE_KEYS = {
  USER: 'google_user',
  ACCESS_TOKEN: 'google_access_token',
  TOKEN_EXPIRY: 'google_token_expiry',
  CALENDAR_EVENTS: 'google_calendar_events',
} as const;

// Google OAuth configuration
export const GOOGLE_OAUTH_SCOPE =
  'openid profile email https://www.googleapis.com/auth/calendar.readonly';
export const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
export const GOOGLE_CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';
