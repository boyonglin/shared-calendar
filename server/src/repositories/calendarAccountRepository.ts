/**
 * Repository for calendar_accounts table operations
 *
 * Provides a clean abstraction over database operations for calendar accounts,
 * improving testability and separation of concerns.
 */
import { db } from "../db";

export type CalendarProvider = "google" | "icloud" | "outlook";

export interface CalendarAccount {
  user_id: string;
  provider: CalendarProvider;
  external_email: string | null;
  access_token: string | null;
  refresh_token: string | null;
  encrypted_password: string | null;
  metadata: string | null;
  primary_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateGoogleAccountParams {
  userId: string;
  email: string;
  accessToken: string;
  refreshToken: string | null;
  metadata: string;
}

export interface CreateICloudAccountParams {
  userId: string;
  email: string;
  encryptedPassword: string;
  metadata: string;
  primaryUserId: string | null;
}

export interface CreateOutlookAccountParams {
  userId: string;
  email: string | null;
  metadata: string;
  primaryUserId: string | null;
}

interface DBRunResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

export const calendarAccountRepository = {
  /**
   * Find a calendar account by user ID
   */
  findByUserId(userId: string): CalendarAccount | undefined {
    const stmt = db.prepare(
      "SELECT * FROM calendar_accounts WHERE user_id = ?",
    );
    return stmt.get(userId) as CalendarAccount | undefined;
  },

  /**
   * Find a calendar account by user ID and provider
   */
  findByUserIdAndProvider(
    userId: string,
    provider: CalendarProvider,
  ): CalendarAccount | undefined {
    const stmt = db.prepare(
      "SELECT * FROM calendar_accounts WHERE user_id = ? AND provider = ?",
    );
    return stmt.get(userId, provider) as CalendarAccount | undefined;
  },

  /**
   * Find all accounts linked to a primary user
   */
  findByPrimaryUserId(primaryUserId: string): CalendarAccount[] {
    const stmt = db.prepare(
      `SELECT * FROM calendar_accounts 
       WHERE user_id = ? OR primary_user_id = ?`,
    );
    return stmt.all(primaryUserId, primaryUserId) as CalendarAccount[];
  },

  /**
   * Find a calendar account by external email
   */
  findByExternalEmail(email: string): CalendarAccount | undefined {
    const stmt = db.prepare(
      "SELECT * FROM calendar_accounts WHERE external_email = ?",
    );
    return stmt.get(email) as CalendarAccount | undefined;
  },

  /**
   * Find account by provider and primary user
   */
  findByProviderAndPrimaryUser(
    provider: CalendarProvider,
    primaryUserId: string,
  ): CalendarAccount | undefined {
    const stmt = db.prepare(
      "SELECT * FROM calendar_accounts WHERE provider = ? AND primary_user_id = ?",
    );
    return stmt.get(provider, primaryUserId) as CalendarAccount | undefined;
  },

  /**
   * Create or update a Google account
   */
  upsertGoogleAccount(params: CreateGoogleAccountParams): void {
    const stmt = db.prepare(`
      INSERT INTO calendar_accounts (
        user_id, provider, external_email, access_token, refresh_token, metadata, updated_at
      ) VALUES (?, 'google', ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        access_token = excluded.access_token,
        refresh_token = COALESCE(excluded.refresh_token, calendar_accounts.refresh_token),
        updated_at = CURRENT_TIMESTAMP
    `);
    stmt.run(
      params.userId,
      params.email,
      params.accessToken,
      params.refreshToken,
      params.metadata,
    );
  },

  /**
   * Create or update an iCloud account
   */
  upsertICloudAccount(params: CreateICloudAccountParams): void {
    const stmt = db.prepare(`
      INSERT INTO calendar_accounts (
        user_id, provider, external_email, encrypted_password, metadata, primary_user_id, updated_at
      ) VALUES (?, 'icloud', ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        encrypted_password = excluded.encrypted_password,
        primary_user_id = excluded.primary_user_id,
        updated_at = CURRENT_TIMESTAMP
    `);
    stmt.run(
      params.userId,
      params.email,
      params.encryptedPassword,
      params.metadata,
      params.primaryUserId,
    );
  },

  /**
   * Create or update an Outlook account
   */
  upsertOutlookAccount(params: CreateOutlookAccountParams): void {
    const stmt = db.prepare(`
      INSERT INTO calendar_accounts (
        user_id, provider, external_email, metadata, primary_user_id, updated_at
      ) VALUES (?, 'outlook', ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        external_email = COALESCE(excluded.external_email, calendar_accounts.external_email),
        metadata = excluded.metadata,
        primary_user_id = excluded.primary_user_id,
        updated_at = CURRENT_TIMESTAMP
    `);
    stmt.run(
      params.userId,
      params.email,
      params.metadata,
      params.primaryUserId,
    );
  },

  /**
   * Update access token for a user
   */
  updateAccessToken(userId: string, accessToken: string): void {
    const stmt = db.prepare(
      "UPDATE calendar_accounts SET access_token = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
    );
    stmt.run(accessToken, userId);
  },

  /**
   * Update refresh token for a user
   */
  updateRefreshToken(userId: string, refreshToken: string): void {
    const stmt = db.prepare(
      "UPDATE calendar_accounts SET refresh_token = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
    );
    stmt.run(refreshToken, userId);
  },

  /**
   * Delete a calendar account by user ID and provider
   */
  deleteByUserIdAndProvider(
    userId: string,
    provider: CalendarProvider,
    primaryUserId: string,
  ): boolean {
    const stmt = db.prepare(
      "DELETE FROM calendar_accounts WHERE user_id = ? AND provider = ? AND primary_user_id = ?",
    );
    const result = stmt.run(userId, provider, primaryUserId) as DBRunResult;
    return result.changes > 0;
  },

  /**
   * Get all external emails for a user (including linked accounts)
   */
  findAllEmailsByPrimaryUserId(primaryUserId: string): string[] {
    const stmt = db.prepare(
      `SELECT external_email FROM calendar_accounts 
       WHERE (user_id = ? OR primary_user_id = ?) AND external_email IS NOT NULL`,
    );
    const results = stmt.all(primaryUserId, primaryUserId) as {
      external_email: string;
    }[];
    return results
      .map((r) => r.external_email?.toLowerCase().trim())
      .filter((email): email is string => !!email);
  },

  /**
   * Check if database is accessible
   */
  healthCheck(): boolean {
    try {
      const stmt = db.prepare("SELECT 1");
      stmt.get();
      return true;
    } catch {
      return false;
    }
  },
};
