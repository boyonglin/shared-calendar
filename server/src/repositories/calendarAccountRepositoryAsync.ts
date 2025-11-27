/**
 * Async repository for calendar_accounts table operations
 *
 * This version uses Turso's async API for Vercel deployment.
 */
import { getDb } from "../db";
import type { Client } from "@libsql/client";

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

export const calendarAccountRepositoryAsync = {
  async findByUserId(userId: string): Promise<CalendarAccount | undefined> {
    const db = await getDb();
    const result = await db.execute({
      sql: "SELECT * FROM calendar_accounts WHERE user_id = ?",
      args: [userId],
    });
    return result.rows[0] as unknown as CalendarAccount | undefined;
  },

  async findByUserIdAndProvider(
    userId: string,
    provider: CalendarProvider,
  ): Promise<CalendarAccount | undefined> {
    const db = await getDb();
    const result = await db.execute({
      sql: "SELECT * FROM calendar_accounts WHERE user_id = ? AND provider = ?",
      args: [userId, provider],
    });
    return result.rows[0] as unknown as CalendarAccount | undefined;
  },

  async findByPrimaryUserId(primaryUserId: string): Promise<CalendarAccount[]> {
    const db = await getDb();
    const result = await db.execute({
      sql: "SELECT * FROM calendar_accounts WHERE user_id = ? OR primary_user_id = ?",
      args: [primaryUserId, primaryUserId],
    });
    return result.rows as unknown as CalendarAccount[];
  },

  async findByExternalEmail(email: string): Promise<CalendarAccount | undefined> {
    const db = await getDb();
    const result = await db.execute({
      sql: "SELECT * FROM calendar_accounts WHERE external_email = ?",
      args: [email],
    });
    return result.rows[0] as unknown as CalendarAccount | undefined;
  },

  async findByProviderAndPrimaryUser(
    provider: CalendarProvider,
    primaryUserId: string,
  ): Promise<CalendarAccount | undefined> {
    const db = await getDb();
    const result = await db.execute({
      sql: "SELECT * FROM calendar_accounts WHERE provider = ? AND primary_user_id = ?",
      args: [provider, primaryUserId],
    });
    return result.rows[0] as unknown as CalendarAccount | undefined;
  },

  async upsertGoogleAccount(params: CreateGoogleAccountParams): Promise<void> {
    const db = await getDb();
    await db.execute({
      sql: `
        INSERT INTO calendar_accounts (
          user_id, provider, external_email, access_token, refresh_token, metadata, updated_at
        ) VALUES (?, 'google', ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
          access_token = excluded.access_token,
          refresh_token = COALESCE(excluded.refresh_token, calendar_accounts.refresh_token),
          updated_at = CURRENT_TIMESTAMP
      `,
      args: [
        params.userId,
        params.email,
        params.accessToken,
        params.refreshToken,
        params.metadata,
      ],
    });
  },

  async upsertICloudAccount(params: CreateICloudAccountParams): Promise<void> {
    const db = await getDb();
    await db.execute({
      sql: `
        INSERT INTO calendar_accounts (
          user_id, provider, external_email, encrypted_password, metadata, primary_user_id, updated_at
        ) VALUES (?, 'icloud', ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
          encrypted_password = excluded.encrypted_password,
          primary_user_id = excluded.primary_user_id,
          updated_at = CURRENT_TIMESTAMP
      `,
      args: [
        params.userId,
        params.email,
        params.encryptedPassword,
        params.metadata,
        params.primaryUserId,
      ],
    });
  },

  async upsertOutlookAccount(params: CreateOutlookAccountParams): Promise<void> {
    const db = await getDb();
    await db.execute({
      sql: `
        INSERT INTO calendar_accounts (
          user_id, provider, external_email, metadata, primary_user_id, updated_at
        ) VALUES (?, 'outlook', ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
          external_email = COALESCE(excluded.external_email, calendar_accounts.external_email),
          metadata = excluded.metadata,
          primary_user_id = excluded.primary_user_id,
          updated_at = CURRENT_TIMESTAMP
      `,
      args: [params.userId, params.email, params.metadata, params.primaryUserId],
    });
  },

  async updateAccessToken(userId: string, accessToken: string): Promise<void> {
    const db = await getDb();
    await db.execute({
      sql: "UPDATE calendar_accounts SET access_token = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
      args: [accessToken, userId],
    });
  },

  async updateRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const db = await getDb();
    await db.execute({
      sql: "UPDATE calendar_accounts SET refresh_token = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
      args: [refreshToken, userId],
    });
  },

  async deleteByUserIdAndProvider(
    userId: string,
    provider: CalendarProvider,
    primaryUserId: string,
  ): Promise<boolean> {
    const db = await getDb();
    const result = await db.execute({
      sql: "DELETE FROM calendar_accounts WHERE user_id = ? AND provider = ? AND primary_user_id = ?",
      args: [userId, provider, primaryUserId],
    });
    return (result.rowsAffected ?? 0) > 0;
  },

  async findAllEmailsByPrimaryUserId(primaryUserId: string): Promise<string[]> {
    const db = await getDb();
    const result = await db.execute({
      sql: `SELECT external_email FROM calendar_accounts 
            WHERE (user_id = ? OR primary_user_id = ?) AND external_email IS NOT NULL`,
      args: [primaryUserId, primaryUserId],
    });
    return (result.rows as unknown as { external_email: string }[])
      .map((r) => r.external_email?.toLowerCase().trim())
      .filter((email): email is string => !!email);
  },

  async healthCheck(): Promise<boolean> {
    try {
      const db = await getDb();
      await db.execute("SELECT 1");
      return true;
    } catch {
      return false;
    }
  },
};
