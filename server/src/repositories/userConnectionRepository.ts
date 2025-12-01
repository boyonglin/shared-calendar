/**
 * Repository for user_connections table operations
 *
 * Uses Turso's async API for both development and production.
 */
import { getDb } from "../db";

export type ConnectionStatus =
  | "pending"
  | "accepted"
  | "incoming"
  | "requested";

export interface UserConnection {
  id: number;
  user_id: string;
  friend_email: string;
  friend_user_id: string | null;
  status: ConnectionStatus;
  created_at: string;
  updated_at: string;
}

export interface UserConnectionWithMetadata extends UserConnection {
  metadata?: string;
}

export const userConnectionRepository = {
  async findById(id: number): Promise<UserConnection | undefined> {
    const db = await getDb();
    const result = await db.execute({
      sql: "SELECT * FROM user_connections WHERE id = ?",
      args: [id],
    });
    return result.rows[0] as unknown as UserConnection | undefined;
  },

  async findByIdAndUserId(
    id: number,
    userId: string,
  ): Promise<UserConnection | undefined> {
    const db = await getDb();
    const result = await db.execute({
      sql: "SELECT * FROM user_connections WHERE id = ? AND user_id = ?",
      args: [id, userId],
    });
    return result.rows[0] as unknown as UserConnection | undefined;
  },

  async findByIdUserIdAndStatus(
    id: number,
    userId: string,
    status: ConnectionStatus,
  ): Promise<UserConnection | undefined> {
    const db = await getDb();
    const result = await db.execute({
      sql: "SELECT * FROM user_connections WHERE id = ? AND user_id = ? AND status = ?",
      args: [id, userId, status],
    });
    return result.rows[0] as unknown as UserConnection | undefined;
  },

  async findByUserIdAndFriendEmail(
    userId: string,
    friendEmail: string,
  ): Promise<UserConnection | undefined> {
    const db = await getDb();
    const result = await db.execute({
      sql: "SELECT * FROM user_connections WHERE user_id = ? AND LOWER(friend_email) = LOWER(?)",
      args: [userId, friendEmail],
    });
    return result.rows[0] as unknown as UserConnection | undefined;
  },

  async findAllByUserId(userId: string): Promise<UserConnectionWithMetadata[]> {
    const db = await getDb();
    const result = await db.execute({
      sql: `
        SELECT uc.*, ca.metadata 
        FROM user_connections uc
        LEFT JOIN calendar_accounts ca ON ca.external_email = uc.friend_email
        WHERE uc.user_id = ? AND uc.status != 'incoming'
        ORDER BY uc.created_at DESC
      `,
      args: [userId],
    });
    return result.rows as unknown as UserConnectionWithMetadata[];
  },

  async findIncomingRequests(
    userId: string,
  ): Promise<UserConnectionWithMetadata[]> {
    const db = await getDb();
    const result = await db.execute({
      sql: `
        SELECT uc.*, ca.metadata 
        FROM user_connections uc
        LEFT JOIN calendar_accounts ca ON ca.external_email = uc.friend_email
        WHERE uc.user_id = ? AND uc.status = 'incoming'
        ORDER BY uc.created_at DESC
      `,
      args: [userId],
    });
    return result.rows as unknown as UserConnectionWithMetadata[];
  },

  async findPendingWithoutFriendUserId(
    userId: string,
  ): Promise<UserConnection[]> {
    const db = await getDb();
    const result = await db.execute({
      sql: `
        SELECT id, friend_email, friend_user_id
        FROM user_connections
        WHERE user_id = ? AND status = 'pending' AND friend_user_id IS NULL
      `,
      args: [userId],
    });
    return result.rows as unknown as UserConnection[];
  },

  async findByUserIdAndFriendUserId(
    userId: string,
    friendUserId: string,
    status?: ConnectionStatus,
  ): Promise<UserConnection | undefined> {
    const db = await getDb();
    if (status) {
      const result = await db.execute({
        sql: "SELECT * FROM user_connections WHERE user_id = ? AND friend_user_id = ? AND status = ?",
        args: [userId, friendUserId, status],
      });
      return result.rows[0] as unknown as UserConnection | undefined;
    }
    const result = await db.execute({
      sql: "SELECT * FROM user_connections WHERE user_id = ? AND friend_user_id = ?",
      args: [userId, friendUserId],
    });
    return result.rows[0] as unknown as UserConnection | undefined;
  },

  async create(
    userId: string,
    friendEmail: string,
    friendUserId: string | null,
    status: ConnectionStatus,
  ): Promise<number> {
    const db = await getDb();
    const result = await db.execute({
      sql: `
        INSERT INTO user_connections (user_id, friend_email, friend_user_id, status)
        VALUES (?, ?, ?, ?)
      `,
      args: [userId, friendEmail, friendUserId, status],
    });
    return Number(result.lastInsertRowid);
  },

  async createOrIgnore(
    userId: string,
    friendEmail: string,
    friendUserId: string | null,
    status: ConnectionStatus,
  ): Promise<boolean> {
    const db = await getDb();
    const result = await db.execute({
      sql: `
        INSERT OR IGNORE INTO user_connections (user_id, friend_email, friend_user_id, status)
        VALUES (?, ?, ?, ?)
      `,
      args: [userId, friendEmail, friendUserId, status],
    });
    return (result.rowsAffected ?? 0) > 0;
  },

  async updateStatus(id: number, status: ConnectionStatus): Promise<boolean> {
    const db = await getDb();
    const result = await db.execute({
      sql: `
        UPDATE user_connections 
        SET status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      args: [status, id],
    });
    return (result.rowsAffected ?? 0) > 0;
  },

  async updateFriendUserIdAndStatus(
    id: number,
    friendUserId: string,
    status: ConnectionStatus,
  ): Promise<boolean> {
    const db = await getDb();
    const result = await db.execute({
      sql: `
        UPDATE user_connections 
        SET friend_user_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      args: [friendUserId, status, id],
    });
    return (result.rowsAffected ?? 0) > 0;
  },

  async updateStatusByUserIdAndFriendUserId(
    userId: string,
    friendUserId: string,
    currentStatus: ConnectionStatus,
    newStatus: ConnectionStatus,
  ): Promise<boolean> {
    const db = await getDb();
    const result = await db.execute({
      sql: `
        UPDATE user_connections 
        SET status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND friend_user_id = ? AND status = ?
      `,
      args: [newStatus, userId, friendUserId, currentStatus],
    });
    return (result.rowsAffected ?? 0) > 0;
  },

  async deleteById(id: number): Promise<boolean> {
    const db = await getDb();
    const result = await db.execute({
      sql: "DELETE FROM user_connections WHERE id = ?",
      args: [id],
    });
    return (result.rowsAffected ?? 0) > 0;
  },

  async deleteByUserIdAndFriendEmail(
    userId: string,
    friendEmail: string,
  ): Promise<boolean> {
    const db = await getDb();
    const result = await db.execute({
      sql: "DELETE FROM user_connections WHERE user_id = ? AND LOWER(friend_email) = LOWER(?)",
      args: [userId, friendEmail],
    });
    return (result.rowsAffected ?? 0) > 0;
  },

  async deleteByUserIdAndFriendUserIdAndStatus(
    userId: string,
    friendUserId: string,
    status: ConnectionStatus,
  ): Promise<boolean> {
    const db = await getDb();
    const result = await db.execute({
      sql: "DELETE FROM user_connections WHERE user_id = ? AND friend_user_id = ? AND status = ?",
      args: [userId, friendUserId, status],
    });
    return (result.rowsAffected ?? 0) > 0;
  },

  async findPendingRequestsByFriendEmail(
    friendEmail: string,
  ): Promise<UserConnectionWithMetadata[]> {
    const db = await getDb();
    const result = await db.execute({
      sql: `
        SELECT uc.*, ca.metadata
        FROM user_connections uc
        LEFT JOIN calendar_accounts ca ON ca.user_id = uc.user_id
        WHERE LOWER(uc.friend_email) = LOWER(?) AND uc.status IN ('pending', 'requested')
      `,
      args: [friendEmail],
    });
    return result.rows as unknown as UserConnectionWithMetadata[];
  },

  /**
   * Delete all connections involving the given user.
   * This removes:
   * - All connections where the user initiated the connection (user_id = userId)
   * - All connections where the user is the friend in someone else's connection (friend_user_id = userId)
   *
   * This bidirectional deletion is critical for data consistency during account deletion.
   */
  async deleteAllByUserId(userId: string): Promise<number> {
    const db = await getDb();
    const result = await db.execute({
      sql: "DELETE FROM user_connections WHERE user_id = ? OR friend_user_id = ?",
      args: [userId, userId],
    });
    return result.rowsAffected ?? 0;
  },
};
