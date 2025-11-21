import { GoogleUser, GoogleCalendarEvent, StoredSession } from '../types/google';
import {
  STORAGE_KEYS,
  TOKEN_EXPIRY_BUFFER_MS,
  TOKEN_EXPIRY_DURATION_MS,
} from '../constants/google';

/**
 * Restore Google session from localStorage
 * @returns Stored session data if valid, null otherwise
 */
export function restoreSession(): StoredSession | null {
  const savedUser = localStorage.getItem(STORAGE_KEYS.USER);
  const savedToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  const savedExpiry = localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY);
  const savedEvents = localStorage.getItem(STORAGE_KEYS.CALENDAR_EVENTS);

  if (savedUser && savedToken && savedExpiry) {
    const expiryTime = parseInt(savedExpiry, 10);
    const now = Date.now();

    // Check if token is still valid (with buffer)
    if (now < expiryTime - TOKEN_EXPIRY_BUFFER_MS) {
      return {
        user: JSON.parse(savedUser),
        accessToken: savedToken,
        events: savedEvents ? JSON.parse(savedEvents) : undefined,
      };
    }
  }

  return null;
}

/**
 * Save user session to localStorage
 */
export function saveUserSession(user: GoogleUser, accessToken: string): void {
  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
  // Google access tokens typically expire in 1 hour
  const expiryTime = Date.now() + TOKEN_EXPIRY_DURATION_MS;
  localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRY, expiryTime.toString());
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
