/**
 * ID Generator Utilities
 *
 * Provides consistent ID generation for optimistic updates across the client.
 */

/**
 * Generate a temporary numeric ID for optimistic updates.
 * Uses negative timestamp to avoid collision with server IDs.
 */
export function generateTempId(): number {
  return -Date.now();
}

/**
 * Generate a temporary string ID for optimistic event updates.
 * Combines timestamp with random string for uniqueness.
 */
export function generateTempEventId(): string {
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
