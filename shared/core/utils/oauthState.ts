/**
 * OAuth State Parameter Utilities
 *
 * Implements CSRF protection for OAuth 2.0 flows using cryptographically
 * secure state tokens. This follows Google's OAuth security best practices.
 *
 * @see https://developers.google.com/identity/protocols/oauth2/resources/best-practices
 */
import crypto from "crypto";
import {
  OAUTH_STATE_EXPIRATION_MS,
  OAUTH_STATE_CLEANUP_INTERVAL_MS,
} from "../constants/index.js";

interface OAuthStateData {
  createdAt: number;
}

// In-memory store for OAuth state tokens
const stateTokens = new Map<string, OAuthStateData>();

/**
 * Generate a cryptographically secure state token for OAuth flows
 * The state token prevents CSRF attacks during OAuth authorization
 */
export function generateOAuthState(): string {
  const state = crypto.randomBytes(32).toString("base64url");
  stateTokens.set(state, {
    createdAt: Date.now(),
  });
  return state;
}

/**
 * Validate and consume an OAuth state token (single-use)
 * Returns true if the state is valid and not expired
 */
export function validateOAuthState(state: string | undefined): boolean {
  if (!state) {
    return false;
  }

  const data = stateTokens.get(state);

  if (!data) {
    return false;
  }

  // Delete immediately (single-use to prevent replay attacks)
  stateTokens.delete(state);

  // Check expiration
  if (Date.now() - data.createdAt > OAUTH_STATE_EXPIRATION_MS) {
    return false;
  }

  return true;
}

/**
 * Clean up expired state tokens periodically
 */
function cleanupExpiredStates() {
  const now = Date.now();
  for (const [state, data] of stateTokens.entries()) {
    if (now - data.createdAt > OAUTH_STATE_EXPIRATION_MS) {
      stateTokens.delete(state);
    }
  }
}

// Start cleanup interval (only in non-test environments)
if (typeof globalThis !== "undefined" && globalThis.setInterval) {
  globalThis.setInterval(cleanupExpiredStates, OAUTH_STATE_CLEANUP_INTERVAL_MS);
}
