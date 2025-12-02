/**
 * Shared Authentication Code Utilities
 *
 * Short-lived, single-use codes for passing auth results from OAuth callbacks.
 */
import crypto from "crypto";
import {
  AUTH_CODE_EXPIRATION_MS,
  AUTH_CODE_CLEANUP_INTERVAL_MS,
} from "../constants/index.js";

interface AuthCodeData {
  userId: string;
  email?: string;
  provider: string;
  createdAt: number;
}

// In-memory store for auth codes
const authCodes = new Map<string, AuthCodeData>();

/**
 * Generate a cryptographically secure random code
 */
function generateSecureCode(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * Store authentication data and return a short-lived exchange code
 */
export function createAuthCode(data: Omit<AuthCodeData, "createdAt">): string {
  const code = generateSecureCode();
  authCodes.set(code, {
    ...data,
    createdAt: Date.now(),
  });
  return code;
}

/**
 * Exchange a code for authentication data (single-use)
 * Returns null if code is invalid, expired, or already used
 */
export function exchangeAuthCode(code: string): AuthCodeData | null {
  const data = authCodes.get(code);

  if (!data) {
    return null;
  }

  // Delete immediately (single-use)
  authCodes.delete(code);

  // Check expiration
  if (Date.now() - data.createdAt > AUTH_CODE_EXPIRATION_MS) {
    return null;
  }

  return data;
}

/**
 * Clean up expired codes periodically
 */
function cleanupExpiredCodes() {
  const now = Date.now();
  for (const [code, data] of authCodes.entries()) {
    if (now - data.createdAt > AUTH_CODE_EXPIRATION_MS) {
      authCodes.delete(code);
    }
  }
}

// Start cleanup interval (only in non-test environments)
if (typeof globalThis !== "undefined" && globalThis.setInterval) {
  globalThis.setInterval(cleanupExpiredCodes, AUTH_CODE_CLEANUP_INTERVAL_MS);
}
