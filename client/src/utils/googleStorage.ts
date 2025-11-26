import type {
  GoogleUser,
  GoogleCalendarEvent,
  StoredSession,
} from "../types/google";
import {
  STORAGE_KEYS,
  TOKEN_EXPIRY_BUFFER_MS,
  TOKEN_EXPIRY_DURATION_MS,
} from "../constants/google";

/**
 * Restore Google session from localStorage
 * Note: Auth tokens are now managed via HTTP-only cookies
 * @returns Stored session data if valid, null otherwise
 */
export function restoreSession(): StoredSession | null {
  const savedUser = localStorage.getItem(STORAGE_KEYS.USER);
  const savedExpiry = localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY);
  const savedEvents = localStorage.getItem(STORAGE_KEYS.CALENDAR_EVENTS);

  if (savedUser && savedExpiry) {
    const expiryTime = parseInt(savedExpiry, 10);
    const now = Date.now();

    // Check if session is still likely valid (with buffer)
    if (now < expiryTime - TOKEN_EXPIRY_BUFFER_MS) {
      return {
        user: JSON.parse(savedUser),
        events: savedEvents ? JSON.parse(savedEvents) : undefined,
      };
    }
  }

  return null;
}

/**
 * Save user session to localStorage
 * Note: Auth tokens are now managed via HTTP-only cookies by the server
 */
export function saveUserSession(user: GoogleUser): void {
  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  // Token expiry is now managed by server-side cookies
  // Keep a session timestamp for UI purposes
  const sessionTime = Date.now() + TOKEN_EXPIRY_DURATION_MS;
  localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRY, sessionTime.toString());
}

/**
 * Save calendar events to localStorage
 */
export function saveCalendarEvents(events: GoogleCalendarEvent[]): void {
  if (events.length > 0) {
    localStorage.setItem(STORAGE_KEYS.CALENDAR_EVENTS, JSON.stringify(events));
  }
}

/**
 * Clear all stored Google session data
 */
export function clearStoredSession(): void {
  localStorage.removeItem(STORAGE_KEYS.USER);
  localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRY);
  localStorage.removeItem(STORAGE_KEYS.CALENDAR_EVENTS);
}
