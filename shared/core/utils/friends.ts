/**
 * Shared Friend Utilities
 */
import { FRIEND_COLORS } from "../constants/index.js";

/**
 * Generate a consistent color for a friend based on their email
 */
export function generateFriendColor(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  return FRIEND_COLORS[Math.abs(hash) % FRIEND_COLORS.length];
}

/**
 * Extract friend name from metadata or fall back to email
 */
export function extractFriendName(
  metadata: string | undefined | null,
  email: string,
): string {
  if (metadata) {
    try {
      const parsed = JSON.parse(metadata);
      return parsed.name || email;
    } catch {
      // Use email as fallback
    }
  }
  return email;
}
