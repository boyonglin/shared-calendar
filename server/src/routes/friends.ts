/**
 * Friends routes - handles friend connections and calendar sharing
 */
import type { Response, NextFunction } from "express";
import express from "express";
import { authenticateUser } from "../middleware/auth.js";
import type { AuthRequest } from "../middleware/auth.js";
import logger, { createRequestLogger, logError } from "../utils/logger.js";
import {
  BadRequestError,
  NotFoundError,
  ConflictError,
} from "../utils/errors.js";

// Import from shared core - all validation and utility functions are centralized here
import {
  googleAuthService,
  icloudAuthService,
  onecalAuthService,
  calendarAccountRepository,
  userConnectionRepository,
  generateFriendColor,
  extractFriendName,
  parseTimeRangeParams,
  isValidEmail,
  validateFriendId,
  emailService,
} from "../../../shared/core/index.js";

const router = express.Router();

// =============================================================================
// Routes
// =============================================================================

/**
 * POST /friends
 * Add a friend by email (sends a friend request)
 */
router.post(
  "/",
  authenticateUser,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const { friendEmail } = req.body;

      if (!friendEmail || typeof friendEmail !== "string") {
        throw new BadRequestError("Friend email is required");
      }

      const normalizedEmail = friendEmail.toLowerCase().trim();

      if (!isValidEmail(normalizedEmail)) {
        throw new BadRequestError("Invalid email format");
      }

      // Check if user is trying to add themselves
      const userEmails =
        await calendarAccountRepository.findAllEmailsByPrimaryUserId(userId);

      if (userEmails.includes(normalizedEmail)) {
        throw new BadRequestError("You cannot add yourself as a friend");
      }

      // Check if connection already exists
      const existing =
        await userConnectionRepository.findByUserIdAndFriendEmail(
          userId,
          normalizedEmail,
        );

      if (existing) {
        const errorMessages: Record<string, string> = {
          accepted: "You are already friends",
          pending: "Friend request pending",
          requested: "Friend request pending",
          incoming: "You have a pending friend request from this user",
        };
        throw new ConflictError(
          errorMessages[existing.status] || "Friend request already sent",
        );
      }

      // Check if friend has an account
      const friendAccount =
        await calendarAccountRepository.findByExternalEmail(normalizedEmail);

      const status = friendAccount ? "requested" : "pending";
      const friendUserId = friendAccount?.user_id || null;

      // Get current user's email for reverse connection
      const primaryUserAccount =
        await calendarAccountRepository.findByUserId(userId);

      try {
        await userConnectionRepository.create(
          userId,
          normalizedEmail,
          friendUserId,
          status,
        );

        // Create incoming request for friend if they have an account
        if (friendAccount && primaryUserAccount?.external_email) {
          const reverseExisting =
            await userConnectionRepository.findByUserIdAndFriendEmail(
              friendAccount.user_id,
              primaryUserAccount.external_email.toLowerCase(),
            );

          if (!reverseExisting) {
            await userConnectionRepository.createOrIgnore(
              friendAccount.user_id,
              primaryUserAccount.external_email.toLowerCase(),
              userId,
              "incoming",
            );
          }
        }
      } catch (dbError: unknown) {
        if (
          dbError instanceof Error &&
          dbError.message.includes("UNIQUE constraint failed")
        ) {
          throw new ConflictError("Friend request already sent");
        }
        throw dbError;
      }

      // Get the inserted connection
      const connection =
        await userConnectionRepository.findByUserIdAndFriendEmail(
          userId,
          normalizedEmail,
        );

      // Send email notification if email service is configured
      if (emailService.isConfigured()) {
        const senderName = extractFriendName(
          primaryUserAccount?.metadata,
          primaryUserAccount?.external_email || "Someone",
        );
        const senderEmail = primaryUserAccount?.external_email || "";

        // Await email to ensure it's sent before serverless function terminates
        // See: https://vercel.com/kb/guide/serverless-functions-and-smtp
        try {
          if (friendAccount) {
            // Friend has an account - send friend request notification
            await emailService.sendFriendRequestNotification(
              normalizedEmail,
              senderName,
              senderEmail,
            );
          } else {
            // Friend doesn't have an account - send invitation to join
            await emailService.sendInviteToJoin(
              normalizedEmail,
              senderName,
              senderEmail,
            );
          }
        } catch (err) {
          // Log but don't fail the request if email fails
          logError(logger, err, "Failed to send email notification");
        }
      }

      res.status(201).json({
        success: true,
        connection: {
          id: connection!.id,
          userId: connection!.user_id,
          friendEmail: connection!.friend_email,
          friendUserId: connection!.friend_user_id,
          friendName: extractFriendName(
            friendAccount?.metadata,
            normalizedEmail,
          ),
          status: connection!.status,
          createdAt: connection!.created_at,
        },
        message:
          status === "requested"
            ? "Friend request sent! They need to accept it."
            : "Friend request sent. They will see it once they sign up.",
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /friends
 * Get all friends for a user (excluding incoming requests)
 */
router.get(
  "/",
  authenticateUser,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;

      const connections =
        await userConnectionRepository.findAllByUserId(userId);

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
      next(error);
    }
  },
);

/**
 * POST /friends/sync-pending
 * Explicitly sync pending friend connections (replaces GET side effects)
 * Call this when you want to check if pending friends have signed up
 */
router.post(
  "/sync-pending",
  authenticateUser,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;

      // Find pending connections where friend might have signed up
      const pendingConnections =
        await userConnectionRepository.findPendingWithoutFriendUserId(userId);

      let updatedCount = 0;

      for (const conn of pendingConnections) {
        const friendAccount =
          await calendarAccountRepository.findByExternalEmail(
            conn.friend_email,
          );

        if (friendAccount) {
          // Update to 'requested' status
          await userConnectionRepository.updateFriendUserIdAndStatus(
            conn.id,
            friendAccount.user_id,
            "requested",
          );

          // Create incoming request for friend
          const currentUser =
            await calendarAccountRepository.findByUserId(userId);

          if (currentUser?.external_email) {
            const reverseExisting =
              await userConnectionRepository.findByUserIdAndFriendEmail(
                friendAccount.user_id,
                currentUser.external_email.toLowerCase(),
              );

            if (!reverseExisting) {
              await userConnectionRepository.create(
                friendAccount.user_id,
                currentUser.external_email.toLowerCase(),
                userId,
                "incoming",
              );
            }
          }
          updatedCount++;
        }
      }

      res.json({
        success: true,
        message: `Synced ${updatedCount} pending connections`,
        updatedCount,
      });
    } catch (error) {
      next(error);
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
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const friendId = validateFriendId(req.params.friendId);

      if (friendId === null) {
        throw new BadRequestError("Invalid friend ID");
      }

      const connection = await userConnectionRepository.findByIdAndUserId(
        friendId,
        userId,
      );

      if (!connection) {
        throw new NotFoundError("Friend connection not found");
      }

      await userConnectionRepository.deleteById(friendId);

      // Remove reverse connection
      if (connection.friend_user_id) {
        const userAccount =
          await calendarAccountRepository.findByUserId(userId);

        if (userAccount?.external_email) {
          await userConnectionRepository.deleteByUserIdAndFriendEmail(
            connection.friend_user_id,
            userAccount.external_email.toLowerCase(),
          );
        }
      }

      res.json({ success: true, message: "Friend removed successfully" });
    } catch (error) {
      next(error);
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
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;

      const connections =
        await userConnectionRepository.findIncomingRequests(userId);

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
      next(error);
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
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const friendId = validateFriendId(req.params.friendId);

      if (friendId === null) {
        throw new BadRequestError("Invalid friend ID");
      }

      const request = await userConnectionRepository.findByIdUserIdAndStatus(
        friendId,
        userId,
        "incoming",
      );

      if (!request) {
        throw new NotFoundError("Friend request not found");
      }

      await userConnectionRepository.updateStatus(friendId, "accepted");

      if (request.friend_user_id) {
        await userConnectionRepository.updateStatusByUserIdAndFriendUserId(
          request.friend_user_id,
          userId,
          "requested",
          "accepted",
        );
      }

      // Send email notification to the requester that their request was accepted
      if (request.friend_user_id && emailService.isConfigured()) {
        // Get the accepter's info (current user)
        const accepterAccount =
          await calendarAccountRepository.findByUserId(userId);
        // Get the requester's email
        const requesterAccount = await calendarAccountRepository.findByUserId(
          request.friend_user_id,
        );

        if (accepterAccount && requesterAccount?.external_email) {
          const accepterName = extractFriendName(
            accepterAccount.metadata,
            accepterAccount.external_email || "Someone",
          );
          const accepterEmail = accepterAccount.external_email || "";

          // Await email to ensure it's sent before serverless function terminates
          // See: https://vercel.com/kb/guide/serverless-functions-and-smtp
          try {
            await emailService.sendFriendRequestAcceptedNotification(
              requesterAccount.external_email,
              accepterName,
              accepterEmail,
            );
          } catch (err) {
            // Log but don't fail the request if email fails
            logError(
              logger,
              err,
              "Failed to send friend accepted email notification",
            );
          }
        }
      }

      res.json({ success: true, message: "Friend request accepted!" });
    } catch (error) {
      next(error);
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
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const friendId = validateFriendId(req.params.friendId);

      if (friendId === null) {
        throw new BadRequestError("Invalid friend ID");
      }

      const request = await userConnectionRepository.findByIdUserIdAndStatus(
        friendId,
        userId,
        "incoming",
      );

      if (!request) {
        throw new NotFoundError("Friend request not found");
      }

      await userConnectionRepository.deleteById(friendId);

      if (request.friend_user_id) {
        await userConnectionRepository.deleteByUserIdAndFriendUserIdAndStatus(
          request.friend_user_id,
          userId,
          "requested",
        );
      }

      res.json({ success: true, message: "Friend request rejected" });
    } catch (error) {
      next(error);
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
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const friendId = validateFriendId(req.params.friendId);

      if (friendId === null) {
        throw new BadRequestError("Invalid friend ID");
      }

      // Check if connection exists and is accepted
      const connection = await userConnectionRepository.findByIdUserIdAndStatus(
        friendId,
        userId,
        "accepted",
      );

      if (!connection || !connection.friend_user_id) {
        throw new NotFoundError("Friend not found or connection not accepted");
      }

      // Verify mutual acceptance
      const reverseConnection =
        await userConnectionRepository.findByUserIdAndFriendUserId(
          connection.friend_user_id,
          userId,
          "accepted",
        );

      if (!reverseConnection) {
        throw new NotFoundError(
          "Friend not found or connection not mutually accepted",
        );
      }

      // Validate time parameters
      const { timeMin, timeMax, error } = parseTimeRangeParams(req.query);
      if (error) {
        throw new BadRequestError(error);
      }

      // Get friend's calendar accounts
      const accounts = await calendarAccountRepository.findByPrimaryUserId(
        connection.friend_user_id,
      );

      const allEvents: Array<Record<string, unknown>> = [];
      const accountErrors: Array<{
        provider: string;
        error: string;
        needsReauth: boolean;
      }> = [];

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

          // Track authentication errors so client can be informed
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          const needsReauth =
            errorMessage.includes("invalid_grant") ||
            errorMessage.includes("Token has been expired or revoked") ||
            errorMessage.includes("Invalid Credentials");

          accountErrors.push({
            provider: account.provider,
            error: needsReauth
              ? "Friend needs to re-authenticate"
              : "Failed to fetch events",
            needsReauth,
          });
        }
      }

      // Return events with consistent format (always object with events and errors arrays)
      res.json({
        events: allEvents,
        errors: accountErrors,
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
