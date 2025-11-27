/**
 * Repository for user_connections table operations
 *
 * Provides a clean abstraction over database operations for friend connections,
 * improving testability and separation of concerns.
 */
import type { Database } from "better-sqlite3";
import { db } from "../db";

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

interface DBRunResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

/**
 * Create a transaction-wrapped version of the repository
 * Usage: userConnectionRepository.transaction(() => { ... })
 */
function createTransaction<T>(fn: () => T): T {
  return (db as Database).transaction(fn)();
}

export const userConnectionRepository = {
  /**
   * Execute operations in a transaction
   */
  transaction: createTransaction,

  /**
   * Find a connection by ID
   */
  findById(id: number): UserConnection | undefined {
    const stmt = db.prepare("SELECT * FROM user_connections WHERE id = ?");
    return stmt.get(id) as UserConnection | undefined;
  },

  /**
   * Find a connection by ID and user ID (for authorization)
   */
  findByIdAndUserId(id: number, userId: string): UserConnection | undefined {
    const stmt = db.prepare(
      "SELECT * FROM user_connections WHERE id = ? AND user_id = ?",
    );
    return stmt.get(id, userId) as UserConnection | undefined;
  },

  /**
   * Find a connection by ID, user ID, and status
   */
  findByIdUserIdAndStatus(
    id: number,
    userId: string,
    status: ConnectionStatus,
  ): UserConnection | undefined {
    const stmt = db.prepare(
      "SELECT * FROM user_connections WHERE id = ? AND user_id = ? AND status = ?",
    );
    return stmt.get(id, userId, status) as UserConnection | undefined;
  },

  /**
   * Find a connection between two users by email
   */
  findByUserIdAndFriendEmail(
    userId: string,
    friendEmail: string,
  ): UserConnection | undefined {
    const stmt = db.prepare(
      "SELECT * FROM user_connections WHERE user_id = ? AND friend_email = ?",
    );
    return stmt.get(userId, friendEmail) as UserConnection | undefined;
  },

  /**
   * Find all connections for a user (excluding incoming)
   */
  findAllByUserId(userId: string): UserConnectionWithMetadata[] {
    const stmt = db.prepare(`
      SELECT uc.*, ca.metadata 
      FROM user_connections uc
      LEFT JOIN calendar_accounts ca ON ca.external_email = uc.friend_email
      WHERE uc.user_id = ? AND uc.status != 'incoming'
      ORDER BY uc.created_at DESC
    `);
    return stmt.all(userId) as UserConnectionWithMetadata[];
  },

  /**
   * Find all incoming requests for a user
   */
  findIncomingRequests(userId: string): UserConnectionWithMetadata[] {
    const stmt = db.prepare(`
      SELECT uc.*, ca.metadata 
      FROM user_connections uc
      LEFT JOIN calendar_accounts ca ON ca.external_email = uc.friend_email
      WHERE uc.user_id = ? AND uc.status = 'incoming'
      ORDER BY uc.created_at DESC
    `);
    return stmt.all(userId) as UserConnectionWithMetadata[];
  },

  /**
   * Find pending connections where friend might have signed up
   */
  findPendingWithoutFriendUserId(userId: string): UserConnection[] {
    const stmt = db.prepare(`
      SELECT id, friend_email, friend_user_id
      FROM user_connections
      WHERE user_id = ? AND status = 'pending' AND friend_user_id IS NULL
    `);
    return stmt.all(userId) as UserConnection[];
  },

  /**
   * Find connection by friend's user ID (for mutual acceptance checks)
   */
  findByUserIdAndFriendUserId(
    userId: string,
    friendUserId: string,
    status?: ConnectionStatus,
  ): UserConnection | undefined {
    if (status) {
      const stmt = db.prepare(
        "SELECT * FROM user_connections WHERE user_id = ? AND friend_user_id = ? AND status = ?",
      );
      return stmt.get(userId, friendUserId, status) as
        | UserConnection
        | undefined;
    }
    const stmt = db.prepare(
      "SELECT * FROM user_connections WHERE user_id = ? AND friend_user_id = ?",
    );
    return stmt.get(userId, friendUserId) as UserConnection | undefined;
  },

  /**
   * Create a new connection
   */
  create(
    userId: string,
    friendEmail: string,
    friendUserId: string | null,
    status: ConnectionStatus,
  ): number {
    const stmt = db.prepare(`
      INSERT INTO user_connections (user_id, friend_email, friend_user_id, status)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(
      userId,
      friendEmail,
      friendUserId,
      status,
    ) as DBRunResult;
    return Number(result.lastInsertRowid);
  },

  /**
   * Create a new connection, ignoring if already exists
   */
  createOrIgnore(
    userId: string,
    friendEmail: string,
    friendUserId: string | null,
    status: ConnectionStatus,
  ): boolean {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO user_connections (user_id, friend_email, friend_user_id, status)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(
      userId,
      friendEmail,
      friendUserId,
      status,
    ) as DBRunResult;
    return result.changes > 0;
  },

  /**
   * Update connection status
   */
  updateStatus(id: number, status: ConnectionStatus): boolean {
    const stmt = db.prepare(`
      UPDATE user_connections 
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    const result = stmt.run(status, id) as DBRunResult;
    return result.changes > 0;
  },

  /**
   * Update friend user ID and status (when pending friend signs up)
   */
  updateFriendUserIdAndStatus(
    id: number,
    friendUserId: string,
    status: ConnectionStatus,
  ): boolean {
    const stmt = db.prepare(`
      UPDATE user_connections 
      SET friend_user_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    const result = stmt.run(friendUserId, status, id) as DBRunResult;
    return result.changes > 0;
  },

  /**
   * Update status for connections by user and friend user IDs
   */
  updateStatusByUserIdAndFriendUserId(
    userId: string,
    friendUserId: string,
    currentStatus: ConnectionStatus,
    newStatus: ConnectionStatus,
  ): boolean {
    const stmt = db.prepare(`
      UPDATE user_connections 
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND friend_user_id = ? AND status = ?
    `);
    const result = stmt.run(
      newStatus,
      userId,
      friendUserId,
      currentStatus,
    ) as DBRunResult;
    return result.changes > 0;
  },

  /**
   * Delete a connection by ID
   */
  deleteById(id: number): boolean {
    const stmt = db.prepare("DELETE FROM user_connections WHERE id = ?");
    const result = stmt.run(id) as DBRunResult;
    return result.changes > 0;
  },

  /**
   * Delete a connection by user ID and friend email
   */
  deleteByUserIdAndFriendEmail(userId: string, friendEmail: string): boolean {
    const stmt = db.prepare(
      "DELETE FROM user_connections WHERE user_id = ? AND friend_email = ?",
    );
    const result = stmt.run(userId, friendEmail) as DBRunResult;
    return result.changes > 0;
  },

  /**
   * Delete connections by user and friend user IDs with specific status
   */
  deleteByUserIdAndFriendUserIdAndStatus(
    userId: string,
    friendUserId: string,
    status: ConnectionStatus,
  ): boolean {
    const stmt = db.prepare(
      "DELETE FROM user_connections WHERE user_id = ? AND friend_user_id = ? AND status = ?",
    );
    const result = stmt.run(userId, friendUserId, status) as DBRunResult;
    return result.changes > 0;
  },

  /**
   * Find all pending/requested connections where friend_email matches a specific email
   * Used when a new user registers to find requests sent to them before they signed up
   */
  findPendingRequestsByFriendEmail(
    friendEmail: string,
  ): UserConnectionWithMetadata[] {
    const stmt = db.prepare(`
      SELECT uc.*, ca.metadata
      FROM user_connections uc
      LEFT JOIN calendar_accounts ca ON ca.user_id = uc.user_id
      WHERE uc.friend_email = ? AND uc.status IN ('pending', 'requested')
    `);
    return stmt.all(friendEmail) as UserConnectionWithMetadata[];
  },
};
