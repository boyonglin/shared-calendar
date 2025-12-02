/**
 * Shared Encryption Utilities
 *
 * AES-256-CBC encryption for sensitive data like iCloud passwords.
 */
import crypto from "crypto";
import { ENCRYPTION_IV_LENGTH } from "../constants/index.js";

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
 * Encrypt a string using AES-256-CBC
 */
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(ENCRYPTION_IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", getEncryptionKey(), iv);
  let encrypted = cipher.update(text, "utf8");
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

/**
 * Decrypt a string encrypted with AES-256-CBC
 */
export function decrypt(text: string): string {
  const textParts = text.split(":");
  if (textParts.length < 2) {
    throw new Error("Invalid encrypted data format");
  }
  const iv = Buffer.from(textParts.shift()!, "hex");
  const encryptedText = Buffer.from(textParts.join(":"), "hex");
  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    getEncryptionKey(),
    iv,
  );
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}
