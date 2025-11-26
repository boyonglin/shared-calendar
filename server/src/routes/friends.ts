/**
 * Friends routes - handles friend connections and calendar sharing
 */
import type { Response } from "express";
import express from "express";
import { googleAuthService } from "../services/googleAuth";
import { icloudAuthService } from "../services/icloudAuth";
import { onecalAuthService } from "../services/onecalAuth";
import { db } from "../db";
import { isValidEmail } from "../middleware/validation";
import { authenticateUser } from "../middleware/auth";
import type { AuthRequest } from "../middleware/auth";
import { createRequestLogger, logError } from "../utils/logger";

const router = express.Router();

// =============================================================================
// Types
// =============================================================================

interface CalendarAccount {
  user_id: string;
  provider: string;
  external_email?: string;
  metadata?: string;
}

interface UserConnectionRow {
  id: number;
  user_id: string;
  friend_email: string;
  friend_user_id: string | null;
  status: string;
  created_at: string;
  metadata?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate a consistent color for a friend based on their email
 */
function generateFriendColor(email: string): string {
  const colors = [
    "#10b981", // green
    "#f59e0b", // amber
    "#8b5cf6", // purple
    "#ec4899", // pink
    "#06b6d4", // cyan
    "#f97316", // orange
    "#6366f1", // indigo
    "#84cc16", // lime
  ];
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

/**
 * Extract friend name from metadata or fall back to email
 */
function extractFriendName(
  metadata: string | undefined,
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

/**
 * Validate friend ID parameter
 */
function validateFriendId(friendIdStr: string): number | null {
  const friendId = parseInt(friendIdStr, 10);
  return isNaN(friendId) ? null : friendId;
}

/**
 * Parse and validate date query parameters
 */
function parseDateParam(value: unknown): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value as string);
  return isNaN(date.getTime()) ? undefined : date;
}

// =============================================================================
// Routes
// =============================================================================

/**
 * POST /friends
 * Add a friend by email (sends a friend request)
 */
router.post("/", authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { friendEmail } = req.body;

    if (!friendEmail || typeof friendEmail !== "string") {
      res.status(400).json({ error: "Friend email is required" });
      return;
    }

    const normalizedEmail = friendEmail.toLowerCase().trim();

    if (!isValidEmail(normalizedEmail)) {
      res.status(400).json({ error: "Invalid email format" });
      return;
    }

    // Check if user is trying to add themselves
    const userEmailsStmt = db.prepare(
      "SELECT external_email FROM calendar_accounts WHERE user_id = ? OR primary_user_id = ?",
    );
    const userAccounts = userEmailsStmt.all(userId, userId) as {
      external_email: string | null;
    }[];
    const userEmails = userAccounts
      .map((acc) => acc.external_email?.toLowerCase().trim())
      .filter((email): email is string => !!email);

    if (userEmails.includes(normalizedEmail)) {
      res.status(400).json({ error: "You cannot add yourself as a friend" });
      return;
    }

    // Check if connection already exists
    const existingStmt = db.prepare(
      "SELECT * FROM user_connections WHERE user_id = ? AND friend_email = ?",
    );
    const existing = existingStmt.get(userId, normalizedEmail) as
      | UserConnectionRow
      | undefined;

    if (existing) {
      const errorMessages: Record<string, string> = {
        accepted: "You are already friends",
        pending: "Friend request pending",
        requested: "Friend request pending",
        incoming: "You have a pending friend request from this user",
      };
      res.status(409).json({
        error: errorMessages[existing.status] || "Friend request already sent",
      });
      return;
    }

    // Check if friend has an account
    const friendStmt = db.prepare(
      "SELECT user_id, metadata FROM calendar_accounts WHERE external_email = ?",
    );
    const friendAccount = friendStmt.get(normalizedEmail) as
      | CalendarAccount
      | undefined;

    const status = friendAccount ? "requested" : "pending";
    const friendUserId = friendAccount?.user_id || null;

    // Get current user's email for reverse connection
    const primaryUserStmt = db.prepare(
      "SELECT external_email FROM calendar_accounts WHERE user_id = ?",
    );
    const primaryUserAccount = primaryUserStmt.get(userId) as
      | { external_email: string }
      | undefined;

    // Use transaction to ensure atomicity
    try {
      const addFriendTransaction = db.transaction(() => {
        const insertStmt = db.prepare(`
          INSERT INTO user_connections (user_id, friend_email, friend_user_id, status)
          VALUES (?, ?, ?, ?)
        `);
        insertStmt.run(userId, normalizedEmail, friendUserId, status);

        // Create incoming request for friend if they have an account
        if (friendAccount && primaryUserAccount?.external_email) {
          const reverseExistingStmt = db.prepare(
            "SELECT * FROM user_connections WHERE user_id = ? AND friend_email = ?",
          );
          const reverseExisting = reverseExistingStmt.get(
            friendAccount.user_id,
            primaryUserAccount.external_email.toLowerCase(),
          );

          if (!reverseExisting) {
            const insertIgnoreStmt = db.prepare(`
              INSERT OR IGNORE INTO user_connections (user_id, friend_email, friend_user_id, status)
              VALUES (?, ?, ?, ?)
            `);
            insertIgnoreStmt.run(
              friendAccount.user_id,
              primaryUserAccount.external_email.toLowerCase(),
              userId,
              "incoming",
            );
          }
        }
      });
      addFriendTransaction();
    } catch (dbError: unknown) {
      if (
        dbError instanceof Error &&
        dbError.message.includes("UNIQUE constraint failed")
      ) {
        res.status(409).json({ error: "Friend request already sent" });
        return;
      }
      throw dbError;
    }

    // Get the inserted connection
    const getStmt = db.prepare(
      "SELECT * FROM user_connections WHERE user_id = ? AND friend_email = ?",
    );
    const connection = getStmt.get(
      userId,
      normalizedEmail,
    ) as UserConnectionRow;

    res.status(201).json({
      success: true,
      connection: {
        id: connection.id,
        userId: connection.user_id,
        friendEmail: connection.friend_email,
        friendUserId: connection.friend_user_id,
        friendName: extractFriendName(friendAccount?.metadata, normalizedEmail),
        status: connection.status,
        createdAt: connection.created_at,
      },
      message:
        status === "requested"
          ? "Friend request sent! They need to accept it."
          : "Friend request sent. They will see it once they sign up.",
    });
  } catch (error) {
    const log = createRequestLogger({
      requestId: (req as AuthRequest & { requestId?: string }).requestId,
      method: req.method,
      path: req.path,
      userId: req.user?.userId,
    });
    logError(log, error, "Error adding friend");
    res.status(500).json({ error: "Failed to add friend" });
  }
});

/**
 * GET /friends
 * Get all friends for a user (excluding incoming requests)
 */
router.get("/", authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const stmt = db.prepare(`
      SELECT uc.*, ca.metadata 
      FROM user_connections uc
      LEFT JOIN calendar_accounts ca ON ca.external_email = uc.friend_email
      WHERE uc.user_id = ? AND uc.status != 'incoming'
      ORDER BY uc.created_at DESC
    `);

    const connections = stmt.all(userId) as UserConnectionRow[];

    const friends = connections.map((conn) => ({
      id: conn.id,
      userId: conn.user_id,
      friendEmail: conn.friend_email,
      friendUserId: conn.friend_user_id,
      friendName: extractFriendName(conn.metadata, conn.friend_email),
      friendColor: generateFriendColor(conn.friend_email),
      status: conn.status,
      createdAt: conn.created_at,
    }));

    res.json({ friends });
  } catch (error) {
    const log = createRequestLogger({
      requestId: (req as AuthRequest & { requestId?: string }).requestId,
      method: req.method,
      path: req.path,
      userId: req.user?.userId,
    });
    logError(log, error, "Error fetching friends");
    res.status(500).json({ error: "Failed to fetch friends" });
  }
});

/**
 * POST /friends/sync-pending
 * Explicitly sync pending friend connections (replaces GET side effects)
 * Call this when you want to check if pending friends have signed up
 */
router.post(
  "/sync-pending",
  authenticateUser,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;

      // Find pending connections where friend might have signed up
      const pendingStmt = db.prepare(`
        SELECT uc.id, uc.friend_email, uc.friend_user_id
        FROM user_connections uc
        WHERE uc.user_id = ? AND uc.status = 'pending' AND uc.friend_user_id IS NULL
      `);
      const pendingConnections = pendingStmt.all(userId) as Array<{
        id: number;
        friend_email: string;
        friend_user_id: string | null;
      }>;

      let updatedCount = 0;

      for (const conn of pendingConnections) {
        const friendStmt = db.prepare(
          "SELECT user_id FROM calendar_accounts WHERE external_email = ?",
        );
        const friendAccount = friendStmt.get(conn.friend_email) as
          | { user_id: string }
          | undefined;

        if (friendAccount) {
          const updateTransaction = db.transaction(() => {
            // Update to 'requested' status
            const updateStmt = db.prepare(`
              UPDATE user_connections 
              SET friend_user_id = ?, status = 'requested', updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `);
            updateStmt.run(friendAccount.user_id, conn.id);

            // Create incoming request for friend
            const currentUserStmt = db.prepare(
              "SELECT external_email FROM calendar_accounts WHERE user_id = ?",
            );
            const currentUser = currentUserStmt.get(userId) as
              | { external_email: string }
              | undefined;

            if (currentUser?.external_email) {
              const reverseExistingStmt = db.prepare(
                "SELECT id FROM user_connections WHERE user_id = ? AND friend_email = ?",
              );
              const reverseExisting = reverseExistingStmt.get(
                friendAccount.user_id,
                currentUser.external_email.toLowerCase(),
              );

              if (!reverseExisting) {
                const insertReverseStmt = db.prepare(`
                  INSERT INTO user_connections (user_id, friend_email, friend_user_id, status)
                  VALUES (?, ?, ?, 'incoming')
                `);
                insertReverseStmt.run(
                  friendAccount.user_id,
                  currentUser.external_email.toLowerCase(),
                  userId,
                );
              }
            }
          });
          updateTransaction();
          updatedCount++;
        }
      }

      res.json({
        success: true,
        message: `Synced ${updatedCount} pending connections`,
        updatedCount,
      });
    } catch (error) {
      const log = createRequestLogger({
        requestId: (req as AuthRequest & { requestId?: string }).requestId,
        method: req.method,
        path: req.path,
        userId: req.user?.userId,
      });
      logError(log, error, "Error syncing pending connections");
      res.status(500).json({ error: "Failed to sync pending connections" });
    }
  },
);

/**
 * DELETE /friends/:friendId
 * Remove a friend (mutual removal)
 */
router.delete(
  "/:friendId",
  authenticateUser,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const friendId = validateFriendId(req.params.friendId);

      if (friendId === null) {
        res.status(400).json({ error: "Invalid friend ID" });
        return;
      }

      const getStmt = db.prepare(
        "SELECT * FROM user_connections WHERE id = ? AND user_id = ?",
      );
      const connection = getStmt.get(friendId, userId) as
        | UserConnectionRow
        | undefined;

      if (!connection) {
        res.status(404).json({ error: "Friend connection not found" });
        return;
      }

      const removeFriendTransaction = db.transaction(() => {
        const deleteStmt = db.prepare(
          "DELETE FROM user_connections WHERE id = ?",
        );
        deleteStmt.run(friendId);

        // Remove reverse connection
        if (connection.friend_user_id) {
          const userStmt = db.prepare(
            "SELECT external_email FROM calendar_accounts WHERE user_id = ?",
          );
          const userAccount = userStmt.get(userId) as
            | { external_email: string }
            | undefined;

          if (userAccount?.external_email) {
            const deleteReverseStmt = db.prepare(
              "DELETE FROM user_connections WHERE user_id = ? AND friend_email = ?",
            );
            deleteReverseStmt.run(
              connection.friend_user_id,
              userAccount.external_email.toLowerCase(),
            );
          }
        }
      });
      removeFriendTransaction();

      res.json({ success: true, message: "Friend removed successfully" });
    } catch (error) {
      const log = createRequestLogger({
        requestId: (req as AuthRequest & { requestId?: string }).requestId,
        method: req.method,
        path: req.path,
        userId: req.user?.userId,
      });
      logError(log, error, "Error removing friend");
      res.status(500).json({ error: "Failed to remove friend" });
    }
  },
);

/**
 * GET /friends/requests/incoming
 * Get incoming friend requests
 */
router.get(
  "/requests/incoming",
  authenticateUser,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;

      const stmt = db.prepare(`
        SELECT uc.*, ca.metadata 
        FROM user_connections uc
        LEFT JOIN calendar_accounts ca ON ca.external_email = uc.friend_email
        WHERE uc.user_id = ? AND uc.status = 'incoming'
        ORDER BY uc.created_at DESC
      `);

      const connections = stmt.all(userId) as UserConnectionRow[];

      const requests = connections.map((conn) => ({
        id: conn.id,
        userId: conn.user_id,
        friendEmail: conn.friend_email,
        friendUserId: conn.friend_user_id,
        friendName: extractFriendName(conn.metadata, conn.friend_email),
        friendColor: generateFriendColor(conn.friend_email),
        status: conn.status,
        createdAt: conn.created_at,
      }));

      res.json({ requests, count: requests.length });
    } catch (error) {
      const log = createRequestLogger({
        requestId: (req as AuthRequest & { requestId?: string }).requestId,
        method: req.method,
        path: req.path,
        userId: req.user?.userId,
      });
      logError(log, error, "Error fetching incoming requests");
      res.status(500).json({ error: "Failed to fetch incoming requests" });
    }
  },
);

/**
 * POST /friends/:friendId/accept
 * Accept a friend request
 */
router.post(
  "/:friendId/accept",
  authenticateUser,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const friendId = validateFriendId(req.params.friendId);

      if (friendId === null) {
        res.status(400).json({ error: "Invalid friend ID" });
        return;
      }

      const getStmt = db.prepare(
        "SELECT * FROM user_connections WHERE id = ? AND user_id = ? AND status = 'incoming'",
      );
      const request = getStmt.get(friendId, userId) as
        | UserConnectionRow
        | undefined;

      if (!request) {
        res.status(404).json({ error: "Friend request not found" });
        return;
      }

      const acceptTransaction = db.transaction(() => {
        const updateStmt = db.prepare(`
          UPDATE user_connections 
          SET status = 'accepted', updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `);
        updateStmt.run(friendId);

        if (request.friend_user_id) {
          const updateOtherStmt = db.prepare(`
            UPDATE user_connections 
            SET status = 'accepted', updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ? AND friend_user_id = ? AND status = 'requested'
          `);
          updateOtherStmt.run(request.friend_user_id, userId);
        }
      });
      acceptTransaction();

      res.json({ success: true, message: "Friend request accepted!" });
    } catch (error) {
      const log = createRequestLogger({
        requestId: (req as AuthRequest & { requestId?: string }).requestId,
        method: req.method,
        path: req.path,
        userId: req.user?.userId,
      });
      logError(log, error, "Error accepting friend request");
      res.status(500).json({ error: "Failed to accept friend request" });
    }
  },
);

/**
 * POST /friends/:friendId/reject
 * Reject a friend request
 */
router.post(
  "/:friendId/reject",
  authenticateUser,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const friendId = validateFriendId(req.params.friendId);

      if (friendId === null) {
        res.status(400).json({ error: "Invalid friend ID" });
        return;
      }

      const getStmt = db.prepare(
        "SELECT * FROM user_connections WHERE id = ? AND user_id = ? AND status = 'incoming'",
      );
      const request = getStmt.get(friendId, userId) as
        | UserConnectionRow
        | undefined;

      if (!request) {
        res.status(404).json({ error: "Friend request not found" });
        return;
      }

      const rejectTransaction = db.transaction(() => {
        const deleteStmt = db.prepare(
          "DELETE FROM user_connections WHERE id = ?",
        );
        deleteStmt.run(friendId);

        if (request.friend_user_id) {
          const deleteOtherStmt = db.prepare(
            "DELETE FROM user_connections WHERE user_id = ? AND friend_user_id = ? AND status = 'requested'",
          );
          deleteOtherStmt.run(request.friend_user_id, userId);
        }
      });
      rejectTransaction();

      res.json({ success: true, message: "Friend request rejected" });
    } catch (error) {
      const log = createRequestLogger({
        requestId: (req as AuthRequest & { requestId?: string }).requestId,
        method: req.method,
        path: req.path,
        userId: req.user?.userId,
      });
      logError(log, error, "Error rejecting friend request");
      res.status(500).json({ error: "Failed to reject friend request" });
    }
  },
);

/**
 * GET /friends/:friendId/events
 * Get friend's calendar events (only for accepted mutual connections)
 */
router.get(
  "/:friendId/events",
  authenticateUser,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const friendId = validateFriendId(req.params.friendId);

      if (friendId === null) {
        res.status(400).json({ error: "Invalid friend ID" });
        return;
      }

      // Check if connection exists and is accepted
      const connStmt = db.prepare(
        "SELECT * FROM user_connections WHERE id = ? AND user_id = ? AND status = 'accepted'",
      );
      const connection = connStmt.get(friendId, userId) as
        | UserConnectionRow
        | undefined;

      if (!connection || !connection.friend_user_id) {
        res.status(404).json({
          error: "Friend not found or connection not accepted",
        });
        return;
      }

      // Verify mutual acceptance
      const reverseConnStmt = db.prepare(
        "SELECT * FROM user_connections WHERE user_id = ? AND friend_user_id = ? AND status = 'accepted'",
      );
      const reverseConnection = reverseConnStmt.get(
        connection.friend_user_id,
        userId,
      ) as UserConnectionRow | undefined;

      if (!reverseConnection) {
        res.status(404).json({
          error: "Friend not found or connection not mutually accepted",
        });
        return;
      }

      const timeMin = parseDateParam(req.query.timeMin);
      const timeMax = parseDateParam(req.query.timeMax);

      if (req.query.timeMin && !timeMin) {
        res.status(400).json({ error: "Invalid timeMin parameter" });
        return;
      }
      if (req.query.timeMax && !timeMax) {
        res.status(400).json({ error: "Invalid timeMax parameter" });
        return;
      }

      // Get friend's calendar accounts
      const accountStmt = db.prepare(
        `SELECT user_id, provider FROM calendar_accounts 
         WHERE user_id = ? OR primary_user_id = ?`,
      );
      const accounts = accountStmt.all(
        connection.friend_user_id,
        connection.friend_user_id,
      ) as CalendarAccount[];

      const allEvents: Array<Record<string, unknown>> = [];

      for (const account of accounts) {
        try {
          let events;
          if (account.provider === "google") {
            events = await googleAuthService.getCalendarEvents(
              account.user_id,
              timeMin,
              timeMax,
            );
          } else if (account.provider === "icloud") {
            events = await icloudAuthService.getCalendarEvents(
              account.user_id,
              timeMin,
              timeMax,
            );
          } else if (account.provider === "outlook") {
            events = await onecalAuthService.getCalendarEvents(
              account.user_id,
              timeMin,
              timeMax,
            );
          }

          if (events && Array.isArray(events)) {
            const taggedEvents = events.map((event) => ({
              ...event,
              userId: account.user_id,
              friendConnectionId: friendId,
            }));
            allEvents.push(...taggedEvents);
          }
        } catch (error) {
          const log = createRequestLogger({
            requestId: (req as AuthRequest & { requestId?: string }).requestId,
            method: req.method,
            path: req.path,
            userId: req.user?.userId,
          });
          logError(
            log,
            error,
            `Error fetching friend events from ${account.provider}`,
          );
        }
      }

      res.json(allEvents);
    } catch (error) {
      const log = createRequestLogger({
        requestId: (req as AuthRequest & { requestId?: string }).requestId,
        method: req.method,
        path: req.path,
        userId: req.user?.userId,
      });
      logError(log, error, "Error fetching friend events");
      res.status(500).json({ error: "Failed to fetch friend events" });
    }
  },
);

export default router;
