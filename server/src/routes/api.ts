import type { Request, Response } from "express";
import express from "express";
import { googleAuthService } from "../services/googleAuth";
import { icloudAuthService } from "../services/icloudAuth";
import { onecalAuthService } from "../services/onecalAuth";
import { aiService } from "../services/ai";
import { db } from "../db";
import {
  validateUserId,
  validatePrimaryUserId,
  validateUserIdParam,
  validateCreateEvent,
  validateDraftInvitation,
} from "../middleware/validation";
import { authenticateUser } from "../middleware/auth";
import type { AuthRequest } from "../middleware/auth";

const router = express.Router();

interface CalendarAccount {
  user_id: string;
  provider: string;
  external_email?: string;
  metadata?: string;
}

interface DBResult {
  changes: number;
}

interface UserConnectionRow {
  id: number;
  user_id: string;
  friend_email: string;
  friend_user_id: string | null;
  status: string;
  created_at: string;
}

router.get("/users/:id", validateUserIdParam, (req: Request, res: Response) => {
  try {
    const user = googleAuthService.getUser(req.params.id);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Fetch events from ALL connected calendar accounts for a user
router.get(
  "/calendar/all-events/:primaryUserId",
  authenticateUser,
  validatePrimaryUserId,
  async (req: Request, res: Response) => {
    try {
      const primaryUserId = (req as AuthRequest).user!.userId;

      // Validate timeMin and timeMax query parameters
      let timeMin: Date | undefined;
      let timeMax: Date | undefined;
      if (req.query.timeMin) {
        timeMin = new Date(req.query.timeMin as string);
        if (isNaN(timeMin.getTime())) {
          res.status(400).json({ error: "Invalid timeMin parameter" });
          return;
        }
      }
      if (req.query.timeMax) {
        timeMax = new Date(req.query.timeMax as string);
        if (isNaN(timeMax.getTime())) {
          res.status(400).json({ error: "Invalid timeMax parameter" });
          return;
        }
      }

      // Get all calendar accounts linked to this primary user
      // This includes their Google account AND any iCloud/Outlook they've connected
      const stmt = db.prepare(
        `SELECT user_id, provider FROM calendar_accounts 
         WHERE user_id = ? OR primary_user_id = ?`,
      );
      const accounts = stmt.all(
        primaryUserId,
        primaryUserId,
      ) as CalendarAccount[];

      if (accounts.length === 0) {
        res.json([]);
        return;
      }

      const allEvents: Array<Record<string, unknown>> = [];

      // Fetch events from each connected account
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
          } else {
            continue; // Skip unsupported providers
          }

          // Tag each event with its user_id for display
          if (events && Array.isArray(events)) {
            const taggedEvents = events.map((event) => ({
              ...event,
              userId: account.user_id, // Map to actual account user_id
            }));

            allEvents.push(...taggedEvents);
          }
        } catch (error: unknown) {
          console.error(
            `Error fetching events from ${account.provider} (${account.user_id}):`,
            error,
          );
          // Continue with other accounts even if one fails
        }
      }

      res.json(allEvents);
    } catch (error: unknown) {
      console.error("Error fetching all events:", error);
      res.status(500).json({ error: "Failed to fetch events" });
    }
  },
);

router.get(
  "/calendar/:userId/events",
  validateUserId,
  async (req: Request, res: Response) => {
    try {
      // Validate timeMin and timeMax query parameters
      let timeMin: Date | undefined;
      let timeMax: Date | undefined;
      if (req.query.timeMin) {
        timeMin = new Date(req.query.timeMin as string);
        if (isNaN(timeMin.getTime())) {
          res.status(400).json({ error: "Invalid timeMin parameter" });
          return;
        }
      }
      if (req.query.timeMax) {
        timeMax = new Date(req.query.timeMax as string);
        if (isNaN(timeMax.getTime())) {
          res.status(400).json({ error: "Invalid timeMax parameter" });
          return;
        }
      }

      // Check which provider this user is using
      const stmt = db.prepare(
        "SELECT provider FROM calendar_accounts WHERE user_id = ?",
      );
      const account = stmt.get(req.params.userId) as
        | CalendarAccount
        | undefined;

      if (!account) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      let events;
      if (account.provider === "google") {
        events = await googleAuthService.getCalendarEvents(
          req.params.userId,
          timeMin,
          timeMax,
        );
      } else if (account.provider === "icloud") {
        events = await icloudAuthService.getCalendarEvents(
          req.params.userId,
          timeMin,
          timeMax,
        );
      } else if (account.provider === "outlook") {
        events = await onecalAuthService.getCalendarEvents(
          req.params.userId,
          timeMin,
          timeMax,
        );
      } else {
        res.status(400).json({ error: "Unsupported provider" });
        return;
      }

      res.json(events);
    } catch (error: unknown) {
      console.error("Error fetching events:", error);

      // Check if it's an auth error
      if (error instanceof Error && error.message === "Unauthorized") {
        res.status(401).json({
          error: "Authentication expired. Please reconnect your calendar.",
        });
        return;
      }

      res.status(500).json({ error: "Failed to fetch events" });
    }
  },
);

router.post(
  "/calendar/events",
  authenticateUser,
  validateCreateEvent,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as AuthRequest).user!.userId;
      const { title, description, start, end, attendees } = req.body;

      // Check provider
      const stmt = db.prepare(
        "SELECT provider, access_token, refresh_token FROM calendar_accounts WHERE user_id = ?",
      );
      const account = stmt.get(userId) as
        | { provider: string; access_token: string; refresh_token?: string }
        | undefined;

      if (!account) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      if (account.provider === "google") {
        const isAllDay = req.body.isAllDay || false;
        const event = await googleAuthService.createEvent(
          userId,
          {
            summary: title,
            description,
            start: isAllDay ? { date: start } : { dateTime: start },
            end: isAllDay ? { date: end } : { dateTime: end },
            attendees: attendees?.map((email: string) => ({ email })),
          },
          account,
        );
        res.json(event);
      } else {
        // TODO: Implement for other providers
        res
          .status(501)
          .json({ error: "Provider not supported for event creation yet" });
      }
    } catch (error) {
      console.error(
        "Error creating event:",
        error instanceof Error ? error.message : "Unknown error",
      );
      res.status(500).json({
        error: "Failed to create event",
      });
    }
  },
);

// Check if user has iCloud connected (for the current authenticated user)
router.get(
  "/calendar/icloud/status",
  authenticateUser,
  (req: Request, res: Response) => {
    try {
      const userId = (req as AuthRequest).user!.userId;

      // Find iCloud account linked to this Google user
      const stmt = db.prepare(
        "SELECT user_id, external_email FROM calendar_accounts WHERE provider = 'icloud' AND primary_user_id = ?",
      );
      const account = stmt.get(userId) as CalendarAccount | undefined;

      if (!account) {
        res.json({ connected: false });
        return;
      }

      res.json({
        connected: true,
        email: account.external_email,
        userId: account.user_id,
      });
    } catch (error) {
      console.error("Error checking iCloud status:", error);
      res.status(500).json({ error: "Failed to check iCloud status" });
    }
  },
);

// Remove iCloud connection
router.delete(
  "/calendar/icloud/:userId",
  authenticateUser,
  validateUserId,
  (req: Request, res: Response) => {
    try {
      const primaryUserId = (req as AuthRequest).user!.userId;

      // Only allow deleting iCloud accounts that belong to the authenticated user
      const stmt = db.prepare(
        "DELETE FROM calendar_accounts WHERE user_id = ? AND provider = 'icloud' AND primary_user_id = ?",
      );
      const result = stmt.run(req.params.userId, primaryUserId) as DBResult;

      if (result.changes === 0) {
        res.status(404).json({ error: "iCloud account not found" });
        return;
      }

      res.json({ success: true, message: "iCloud account disconnected" });
    } catch (error) {
      console.error("Error removing iCloud account:", error);
      res.status(500).json({ error: "Failed to remove iCloud account" });
    }
  },
);

// Check if user has Outlook connected (for the current authenticated user)
router.get(
  "/calendar/outlook/status",
  authenticateUser,
  (req: Request, res: Response) => {
    try {
      const userId = (req as AuthRequest).user!.userId;

      // Find Outlook account linked to this Google user
      const stmt = db.prepare(
        "SELECT user_id, external_email FROM calendar_accounts WHERE provider = 'outlook' AND primary_user_id = ?",
      );
      const account = stmt.get(userId) as CalendarAccount | undefined;

      if (!account) {
        res.json({ connected: false });
        return;
      }

      res.json({
        connected: true,
        email: account.external_email,
        userId: account.user_id,
      });
    } catch (error) {
      console.error("Error checking Outlook status:", error);
      res.status(500).json({ error: "Failed to check Outlook status" });
    }
  },
);

// Remove Outlook connection
router.delete(
  "/calendar/outlook/:userId",
  authenticateUser,
  validateUserId,
  (req: Request, res: Response) => {
    try {
      const primaryUserId = (req as AuthRequest).user!.userId;

      // Only allow deleting Outlook accounts that belong to the authenticated user
      const stmt = db.prepare(
        "DELETE FROM calendar_accounts WHERE user_id = ? AND provider = 'outlook' AND primary_user_id = ?",
      );
      const result = stmt.run(req.params.userId, primaryUserId) as DBResult;

      if (result.changes === 0) {
        res.status(404).json({ error: "Outlook account not found" });
        return;
      }

      res.json({ success: true, message: "Outlook account disconnected" });
    } catch (error) {
      console.error("Error removing Outlook account:", error);
      res.status(500).json({ error: "Failed to remove Outlook account" });
    }
  },
);

// Generate AI invitation draft
router.post(
  "/ai/draft-invitation",
  authenticateUser,
  validateDraftInvitation,
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        title,
        description,
        start,
        end,
        attendees,
        location,
        tone,
        geminiApiKey,
      } = req.body;

      const draft = await aiService.generateInvitationDraft(
        {
          title,
          description,
          start,
          end,
          attendees,
          location,
        },
        tone,
        geminiApiKey,
      );

      res.json({ draft });
    } catch (error) {
      console.error("Error generating invitation draft:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Failed to generate invitation draft";
      res.status(500).json({ error: message });
    }
  },
);

// ==================== FRIEND CONNECTIONS ====================

// Helper to generate a color for a friend
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
  // Simple hash based on email to get consistent color
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// Add a friend by email (sends a friend REQUEST, not auto-accept)
router.post(
  "/friends",
  authenticateUser,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const { friendEmail } = req.body;

      if (!friendEmail || typeof friendEmail !== "string") {
        res.status(400).json({ error: "Friend email is required" });
        return;
      }

      const normalizedEmail = friendEmail.toLowerCase().trim();

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedEmail)) {
        res.status(400).json({ error: "Invalid email format" });
        return;
      }

      // Check if user is trying to add themselves
      const userStmt = db.prepare(
        "SELECT external_email FROM calendar_accounts WHERE user_id = ?",
      );
      const userAccount = userStmt.get(userId) as CalendarAccount | undefined;
      if (userAccount?.external_email?.toLowerCase() === normalizedEmail) {
        res.status(400).json({ error: "You cannot add yourself as a friend" });
        return;
      }

      // Check if connection already exists (outgoing request from current user)
      const existingStmt = db.prepare(
        "SELECT * FROM user_connections WHERE user_id = ? AND friend_email = ?",
      );
      const existing = existingStmt.get(userId, normalizedEmail);
      if (existing) {
        res.status(409).json({ error: "Friend request already sent" });
        return;
      }

      // Check if friend has an account (by email in calendar_accounts)
      const friendStmt = db.prepare(
        "SELECT user_id, metadata FROM calendar_accounts WHERE external_email = ?",
      );
      const friendAccount = friendStmt.get(normalizedEmail) as
        | CalendarAccount
        | undefined;

      // Insert the outgoing connection request
      const insertStmt = db.prepare(`
        INSERT INTO user_connections (user_id, friend_email, friend_user_id, status)
        VALUES (?, ?, ?, ?)
      `);

      // Status is 'pending' (waiting for friend to sign up) or 'requested' (friend exists, waiting for acceptance)
      const status = friendAccount ? "requested" : "pending";
      const friendUserId = friendAccount?.user_id || null;

      // Wrap both inserts in a transaction to ensure atomicity
      const addFriendTransaction = db.transaction(() => {
        insertStmt.run(userId, normalizedEmail, friendUserId, status);

        // If friend already has an account, create an INCOMING request for them
        if (friendAccount && userAccount?.external_email) {
          const reverseExistingStmt = db.prepare(
            "SELECT * FROM user_connections WHERE user_id = ? AND friend_email = ?",
          );
          const reverseExisting = reverseExistingStmt.get(
            friendAccount.user_id,
            userAccount.external_email.toLowerCase(),
          );

          if (!reverseExisting) {
            // Create incoming request for the friend (they need to accept)
            insertStmt.run(
              friendAccount.user_id,
              userAccount.external_email.toLowerCase(),
              userId,
              "incoming", // This is an incoming request they need to accept
            );
          }
        }
      });
      addFriendTransaction();

      // Get the inserted connection
      const getStmt = db.prepare(
        "SELECT * FROM user_connections WHERE user_id = ? AND friend_email = ?",
      );
      const connection = getStmt.get(
        userId,
        normalizedEmail,
      ) as UserConnectionRow;

      // Get friend's name from metadata if available
      let friendName = normalizedEmail;
      if (friendAccount?.metadata) {
        try {
          const metadata = JSON.parse(friendAccount.metadata);
          friendName = metadata.name || normalizedEmail;
        } catch {
          // Use email as name
        }
      }

      res.status(201).json({
        success: true,
        connection: {
          id: connection.id,
          userId: connection.user_id,
          friendEmail: connection.friend_email,
          friendUserId: connection.friend_user_id,
          friendName,
          status: connection.status,
          createdAt: connection.created_at,
        },
        message:
          status === "requested"
            ? "Friend request sent! They need to accept it."
            : "Friend request sent. They will see it once they sign up.",
      });
    } catch (error) {
      console.error("Error adding friend:", error);
      res.status(500).json({ error: "Failed to add friend" });
    }
  },
);

// Get all friends for a user (excluding incoming requests - those are separate)
router.get(
  "/friends",
  authenticateUser,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;

      const stmt = db.prepare(`
        SELECT uc.*, ca.metadata 
        FROM user_connections uc
        LEFT JOIN calendar_accounts ca ON ca.external_email = uc.friend_email
        WHERE uc.user_id = ? AND uc.status != 'incoming'
        ORDER BY uc.created_at DESC
      `);

      const connections = stmt.all(userId) as Array<
        UserConnectionRow & { metadata?: string }
      >;

      const friends = connections.map((conn) => {
        let friendName = conn.friend_email;
        if (conn.metadata) {
          try {
            const metadata = JSON.parse(conn.metadata);
            friendName = metadata.name || conn.friend_email;
          } catch {
            // Use email as name
          }
        }

        // Check if friend now has an account (for pending connections - user not yet signed up)
        // Note: Ideally this would be handled during friend signup, but for backwards
        // compatibility we check here and update lazily
        if (conn.status === "pending" && !conn.friend_user_id) {
          const friendStmt = db.prepare(
            "SELECT user_id FROM calendar_accounts WHERE external_email = ?",
          );
          const friendAccount = friendStmt.get(conn.friend_email) as
            | { user_id: string }
            | undefined;

          if (friendAccount) {
            // Wrap the status update in a transaction for atomicity
            const updatePendingConnection = db.transaction(() => {
              // Friend signed up! Update to 'requested' status (they need to accept)
              const updateStmt = db.prepare(`
                UPDATE user_connections 
                SET friend_user_id = ?, status = 'requested', updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
              `);
              updateStmt.run(friendAccount.user_id, conn.id);

              // Create an INCOMING request for the friend
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
            updatePendingConnection();

            conn.friend_user_id = friendAccount.user_id;
            conn.status = "requested";
          }
        }

        return {
          id: conn.id,
          userId: conn.user_id,
          friendEmail: conn.friend_email,
          friendUserId: conn.friend_user_id,
          friendName,
          friendColor: generateFriendColor(conn.friend_email),
          status: conn.status,
          createdAt: conn.created_at,
        };
      });

      res.json({ friends });
    } catch (error) {
      console.error("Error fetching friends:", error);
      res.status(500).json({ error: "Failed to fetch friends" });
    }
  },
);

// Remove a friend (mutual - removes both directions)
router.delete(
  "/friends/:friendId",
  authenticateUser,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const friendId = parseInt(req.params.friendId, 10);

      if (isNaN(friendId)) {
        res.status(400).json({ error: "Invalid friend ID" });
        return;
      }

      // First, get the connection to find the friend's user_id
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

      // Wrap the deletion logic in a transaction for atomicity
      const removeFriendTransaction = db.transaction(() => {
        // Delete the user's connection
        const deleteStmt = db.prepare(
          "DELETE FROM user_connections WHERE id = ?",
        );
        deleteStmt.run(friendId);

        // Also delete the reverse connection (mutual removal)
        if (connection.friend_user_id) {
          // Get current user's email to find reverse connection
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
      console.error("Error removing friend:", error);
      res.status(500).json({ error: "Failed to remove friend" });
    }
  },
);

// Get incoming friend requests (requests that need to be accepted)
router.get(
  "/friends/requests/incoming",
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

      const connections = stmt.all(userId) as Array<
        UserConnectionRow & { metadata?: string }
      >;

      const requests = connections.map((conn) => {
        let friendName = conn.friend_email;
        if (conn.metadata) {
          try {
            const metadata = JSON.parse(conn.metadata);
            friendName = metadata.name || conn.friend_email;
          } catch {
            // Use email as name
          }
        }

        return {
          id: conn.id,
          userId: conn.user_id,
          friendEmail: conn.friend_email,
          friendUserId: conn.friend_user_id,
          friendName,
          friendColor: generateFriendColor(conn.friend_email),
          status: conn.status,
          createdAt: conn.created_at,
        };
      });

      res.json({ requests, count: requests.length });
    } catch (error) {
      console.error("Error fetching incoming requests:", error);
      res.status(500).json({ error: "Failed to fetch incoming requests" });
    }
  },
);

// Accept a friend request
router.post(
  "/friends/:friendId/accept",
  authenticateUser,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const friendId = parseInt(req.params.friendId, 10);

      if (isNaN(friendId)) {
        res.status(400).json({ error: "Invalid friend ID" });
        return;
      }

      // Get the incoming request
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

      // Perform both updates in a transaction to ensure consistency
      const acceptFriendRequest = db.transaction(() => {
        // Update the incoming request to accepted
        const updateStmt = db.prepare(`
          UPDATE user_connections 
          SET status = 'accepted', updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `);
        updateStmt.run(friendId);

        // Update the other person's request to accepted too
        if (request.friend_user_id) {
          const updateOtherStmt = db.prepare(`
            UPDATE user_connections 
            SET status = 'accepted', updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ? AND friend_user_id = ? AND status = 'requested'
          `);
          updateOtherStmt.run(request.friend_user_id, userId);
        }
      });
      acceptFriendRequest();

      res.json({ success: true, message: "Friend request accepted!" });
    } catch (error) {
      console.error("Error accepting friend request:", error);
      res.status(500).json({ error: "Failed to accept friend request" });
    }
  },
);

// Reject a friend request
router.post(
  "/friends/:friendId/reject",
  authenticateUser,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const friendId = parseInt(req.params.friendId, 10);

      if (isNaN(friendId)) {
        res.status(400).json({ error: "Invalid friend ID" });
        return;
      }

      // Get the incoming request
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

      // Delete both the incoming and outgoing request in a transaction
      const rejectFriendRequest = db.transaction(() => {
        const deleteStmt = db.prepare(
          "DELETE FROM user_connections WHERE id = ?",
        );
        deleteStmt.run(friendId);

        // Also delete the other person's outgoing request
        if (request.friend_user_id) {
          const deleteOtherStmt = db.prepare(
            "DELETE FROM user_connections WHERE user_id = ? AND friend_user_id = ? AND status = 'requested'",
          );
          deleteOtherStmt.run(request.friend_user_id, userId);
        }
      });
      rejectFriendRequest();

      res.json({ success: true, message: "Friend request rejected" });
    } catch (error) {
      console.error("Error rejecting friend request:", error);
      res.status(500).json({ error: "Failed to reject friend request" });
    }
  },
);

// Get friend's calendar events (for accepted connections only)
router.get(
  "/friends/:friendId/events",
  authenticateUser,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;
      const friendId = parseInt(req.params.friendId, 10);

      if (isNaN(friendId)) {
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

      // Validate timeMin and timeMax query parameters
      let timeMin: Date | undefined;
      let timeMax: Date | undefined;
      if (req.query.timeMin) {
        timeMin = new Date(req.query.timeMin as string);
        if (isNaN(timeMin.getTime())) {
          res.status(400).json({ error: "Invalid timeMin parameter" });
          return;
        }
      }
      if (req.query.timeMax) {
        timeMax = new Date(req.query.timeMax as string);
        if (isNaN(timeMax.getTime())) {
          res.status(400).json({ error: "Invalid timeMax parameter" });
          return;
        }
      }

      // Get friend's calendar accounts (Google + any iCloud/Outlook they've linked)
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
          console.error(
            `Error fetching friend events from ${account.provider}:`,
            error,
          );
        }
      }

      res.json(allEvents);
    } catch (error) {
      console.error("Error fetching friend events:", error);
      res.status(500).json({ error: "Failed to fetch friend events" });
    }
  },
);

export default router;
