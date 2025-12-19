/**
 * Shared Encryption Utilities
 *
 * AES-256-GCM encryption for sensitive data like iCloud passwords.
 */
import crypto from "crypto";

/** IV length for AES-256-GCM encryption */
const ENCRYPTION_IV_LENGTH = 16;

/**
 * Get the encryption key from environment
 */
function getEncryptionKey(): Buffer {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error(
      "ENCRYPTION_KEY is required for iCloud integration. Please set it in your environment.",
    );
  }

  // If the key is a hex string (64 characters), decode it
  if (encryptionKey.length === 64 && /^[0-9a-fA-F]+$/.test(encryptionKey)) {
    return Buffer.from(encryptionKey, "hex");
  }

  // Otherwise treat as raw string and validate length
  const key = Buffer.from(encryptionKey);
  if (key.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY must be exactly 32 bytes (or 64 hex characters), got ${key.length} bytes`,
    );
  }
  return key;
}

/**
 * Encrypt a string using AES-256-GCM
 * GCM mode provides both confidentiality and authenticity
 */
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(ENCRYPTION_IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  let encrypted = cipher.update(text, "utf8");
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();
  return (
    iv.toString("hex") +
    ":" +
    encrypted.toString("hex") +
    ":" +
    authTag.toString("hex")
  );
}

/**
 * Decrypt a string encrypted with AES-256-GCM
 * GCM mode provides both confidentiality and authenticity
 */
export function decrypt(text: string): string {
  const textParts = text.split(":");
  if (textParts.length < 3) {
    throw new Error("Invalid encrypted data format");
  }
  const iv = Buffer.from(textParts[0], "hex");
  const encryptedText = Buffer.from(textParts[1], "hex");
  const authTag = Buffer.from(textParts[2], "hex");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    iv,
  );
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}
