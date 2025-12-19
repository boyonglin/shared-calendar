import { ONE_MINUTE_MS, JWT_COOKIE_MAX_AGE_MS } from "@shared/core/constants";

// Token expiry buffer (5 minutes before actual expiry)
export const TOKEN_EXPIRY_BUFFER_MS = 5 * ONE_MINUTE_MS;

// Token expiry duration (matches JWT cookie max age)
export const TOKEN_EXPIRY_DURATION_MS = JWT_COOKIE_MAX_AGE_MS;

// Google Sign-in button icon dimensions
export const GOOGLE_ICON_SIZE = 18;
export const GOOGLE_ICON_VIEWBOX_SIZE = 48;

// Re-export storage keys for backward compatibility
export { STORAGE_KEYS } from "./storage";
