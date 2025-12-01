/**
 * Calendar routes - handles calendar events and provider integrations
 */
import type { Request, Response, NextFunction } from "express";
import express from "express";
import {
  validateUserId,
  validatePrimaryUserId,
  validateCreateEvent,
} from "../middleware/validation";
import { authenticateUser } from "../middleware/auth";
import type { AuthRequest } from "../middleware/auth";
import { createRequestLogger, logError } from "../utils/logger";
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
  UnauthorizedError,
  NotImplementedError,
} from "../utils/errors";

// Import from shared core
import {
  googleAuthService,
  icloudAuthService,
  onecalAuthService,
  calendarAccountRepository,
  type CalendarAccount,
} from "../../../shared/core";

const router = express.Router();

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Parse and validate date query parameters
 */
function parseDateParam(
  value: unknown,
): { valid: true; date: Date } | { valid: false; error: string } {
  if (!value) {
    return { valid: true, date: undefined as unknown as Date };
  }
  const date = new Date(value as string);
  if (isNaN(date.getTime())) {
    return { valid: false, error: "Invalid date parameter" };
  }
  return { valid: true, date };
}

/**
 * Fetch events from a calendar provider
 */
async function fetchEventsFromProvider(
  account: CalendarAccount,
  timeMin?: Date,
  timeMax?: Date,
): Promise<Array<Record<string, unknown>>> {
  switch (account.provider) {
    case "google": {
      const events = await googleAuthService.getCalendarEvents(
        account.user_id,
        timeMin,
        timeMax,
      );
      return (events || []) as unknown as Array<Record<string, unknown>>;
    }
    case "icloud": {
      const events = await icloudAuthService.getCalendarEvents(
        account.user_id,
        timeMin,
        timeMax,
      );
      return (events || []) as unknown as Array<Record<string, unknown>>;
    }
    case "outlook": {
      const events = await onecalAuthService.getCalendarEvents(
        account.user_id,
        timeMin,
        timeMax,
      );
      return (events || []) as unknown as Array<Record<string, unknown>>;
    }
    default:
      return [];
  }
}

// =============================================================================
// Routes
// =============================================================================

/**
 * GET /calendar/all-events/:primaryUserId
 * Fetch events from ALL connected calendar accounts for a user
 */
router.get(
  "/all-events/:primaryUserId",
  authenticateUser,
  validatePrimaryUserId,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const primaryUserId = (req as AuthRequest).user!.userId;

      // Validate time parameters
      const timeMinResult = parseDateParam(req.query.timeMin);
      if (!timeMinResult.valid) {
        throw new BadRequestError("Invalid timeMin parameter");
      }
      const timeMaxResult = parseDateParam(req.query.timeMax);
      if (!timeMaxResult.valid) {
        throw new BadRequestError("Invalid timeMax parameter");
      }

      const timeMin = timeMinResult.date || undefined;
      const timeMax = timeMaxResult.date || undefined;

      // Get all calendar accounts linked to this primary user
      const accounts =
        await calendarAccountRepository.findByPrimaryUserId(primaryUserId);

      if (accounts.length === 0) {
        res.json([]);
        return;
      }

      const allEvents: Array<Record<string, unknown>> = [];

      // Fetch events from each connected account
      for (const account of accounts) {
        try {
          const events = await fetchEventsFromProvider(
            account,
            timeMin,
            timeMax,
          );

          // Tag each event with its user_id for display
          const taggedEvents = events.map((event) => ({
            ...event,
            userId: account.user_id,
          }));

          allEvents.push(...taggedEvents);
        } catch (error: unknown) {
          const log = createRequestLogger({
            requestId: (req as Request & { requestId?: string }).requestId,
            method: req.method,
            path: req.path,
          });
          logError(
            log,
            error,
            `Error fetching events from ${account.provider} (${account.user_id})`,
          );
          // Continue with other accounts even if one fails
        }
      }

      res.json(allEvents);
    } catch (error: unknown) {
      next(error);
    }
  },
);

/** SSE connection timeout in milliseconds (30 seconds) */
const SSE_TIMEOUT_MS = 30_000;

/** SSE heartbeat interval in milliseconds (15 seconds) */
const SSE_HEARTBEAT_INTERVAL_MS = 15_000;

/**
 * GET /calendar/events-stream/:primaryUserId
 * Stream events from ALL connected calendar accounts as each platform completes
 * Uses Server-Sent Events (SSE) to progressively send events
 */
router.get(
  "/events-stream/:primaryUserId",
  authenticateUser,
  validatePrimaryUserId,
  async (req: Request, res: Response, next: NextFunction) => {
    // Track timers for cleanup
    let connectionTimeout: ReturnType<typeof globalThis.setTimeout> | null =
      null;
    let heartbeatInterval: ReturnType<typeof globalThis.setInterval> | null =
      null;
    let isConnectionClosed = false;

    // Helper to safely write to response
    const safeWrite = (data: string): boolean => {
      if (isConnectionClosed) return false;
      try {
        res.write(data);
        return true;
      } catch {
        isConnectionClosed = true;
        return false;
      }
    };

    // Helper to clean up timers
    const cleanup = () => {
      isConnectionClosed = true;
      if (connectionTimeout) {
        globalThis.clearTimeout(connectionTimeout);
        connectionTimeout = null;
      }
      if (heartbeatInterval) {
        globalThis.clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
    };

    // Helper to end the stream gracefully
    const endStream = (data?: { type: string; message?: string }) => {
      if (data) {
        safeWrite(`data: ${JSON.stringify(data)}\n\n`);
      }
      cleanup();
      if (!res.writableEnded) {
        res.end();
      }
    };

    try {
      const primaryUserId = (req as AuthRequest).user!.userId;

      // Validate time parameters before setting up SSE
      const timeMinResult = parseDateParam(req.query.timeMin);
      if (!timeMinResult.valid) {
        throw new BadRequestError("Invalid timeMin parameter");
      }
      const timeMaxResult = parseDateParam(req.query.timeMax);
      if (!timeMaxResult.valid) {
        throw new BadRequestError("Invalid timeMax parameter");
      }

      const timeMin = timeMinResult.date || undefined;
      const timeMax = timeMaxResult.date || undefined;

      // Get all calendar accounts linked to this primary user
      const accounts =
        await calendarAccountRepository.findByPrimaryUserId(primaryUserId);

      // Set up SSE headers
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering
      res.flushHeaders();

      // Handle client disconnect
      req.on("close", cleanup);

      // Set up connection timeout to prevent resource exhaustion
      connectionTimeout = globalThis.setTimeout(() => {
        if (!isConnectionClosed) {
          endStream({ type: "timeout", message: "Connection timed out" });
        }
      }, SSE_TIMEOUT_MS);

      // Set up heartbeat to keep connection alive
      heartbeatInterval = globalThis.setInterval(() => {
        if (!isConnectionClosed) {
          // SSE comment line for keep-alive (not parsed as data by clients)
          safeWrite(": heartbeat\n\n");
        }
      }, SSE_HEARTBEAT_INTERVAL_MS);

      if (accounts.length === 0) {
        endStream({ type: "complete" });
        return;
      }

      // Fetch events from all accounts in parallel, stream as each completes
      const fetchPromises = accounts.map(async (account) => {
        if (isConnectionClosed) return;

        try {
          const events = await fetchEventsFromProvider(
            account,
            timeMin,
            timeMax,
          );

          if (isConnectionClosed) return;

          // Tag each event with its user_id for display
          const taggedEvents = events.map((event) => ({
            ...event,
            userId: account.user_id,
          }));

          // Send this platform's events immediately
          safeWrite(
            `data: ${JSON.stringify({
              type: "events",
              provider: account.provider,
              events: taggedEvents,
            })}\n\n`,
          );
        } catch (error: unknown) {
          if (isConnectionClosed) return;

          const log = createRequestLogger({
            requestId: (req as Request & { requestId?: string }).requestId,
            method: req.method,
            path: req.path,
          });
          logError(
            log,
            error,
            `Error fetching events from ${account.provider} (${account.user_id})`,
          );

          // Send error event for this provider but continue with others
          safeWrite(
            `data: ${JSON.stringify({
              type: "error",
              provider: account.provider,
              message: `Failed to fetch ${account.provider} events`,
            })}\n\n`,
          );
        }
      });

      // Wait for all fetches to complete
      await Promise.all(fetchPromises);

      if (!isConnectionClosed) {
        endStream({ type: "complete" });
      }
    } catch (error: unknown) {
      cleanup();
      // For SSE, we can't use next() after headers are sent
      // If headers haven't been sent yet, use error handler
      if (!res.headersSent) {
        next(error);
      } else {
        endStream({ type: "error", message: "Stream error" });
      }
    }
  },
);

/**
 * GET /calendar/:userId/events
 * Fetch events for a specific user account
 */
router.get(
  "/:userId/events",
  authenticateUser,
  validateUserId,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUserId = (req as AuthRequest).user!.userId;
      const requestedUserId = req.params.userId;

      // Validate time parameters
      const timeMinResult = parseDateParam(req.query.timeMin);
      if (!timeMinResult.valid) {
        throw new BadRequestError("Invalid timeMin parameter");
      }
      const timeMaxResult = parseDateParam(req.query.timeMax);
      if (!timeMaxResult.valid) {
        throw new BadRequestError("Invalid timeMax parameter");
      }

      const timeMin = timeMinResult.date || undefined;
      const timeMax = timeMaxResult.date || undefined;

      // Check which provider this user is using
      const account =
        await calendarAccountRepository.findByUserId(requestedUserId);

      if (!account) {
        throw new NotFoundError("User not found");
      }

      // Authorization: user can only access their own accounts or linked accounts
      const isOwnAccount = requestedUserId === authUserId;
      const isLinkedAccount =
        account.primary_user_id != null &&
        account.primary_user_id === authUserId;
      if (!isOwnAccount && !isLinkedAccount) {
        throw new ForbiddenError("Not authorized to access this calendar");
      }

      const events = await fetchEventsFromProvider(
        { ...account, user_id: requestedUserId },
        timeMin,
        timeMax,
      );

      if (
        events.length === 0 &&
        !["google", "icloud", "outlook"].includes(account.provider)
      ) {
        throw new BadRequestError("Unsupported provider");
      }

      res.json(events);
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "Unauthorized") {
        next(
          new UnauthorizedError(
            "Authentication expired. Please reconnect your calendar.",
          ),
        );
        return;
      }
      next(error);
    }
  },
);

/**
 * POST /calendar/events
 * Create a new calendar event
 */
router.post(
  "/events",
  authenticateUser,
  validateCreateEvent,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthRequest).user!.userId;
      const { title, description, start, end, attendees, isAllDay } = req.body;

      // Check provider
      const account = await calendarAccountRepository.findByUserId(userId);

      if (!account) {
        throw new NotFoundError("User not found");
      }

      if (account.provider === "google") {
        if (!account.access_token) {
          throw new UnauthorizedError(
            "Google account not properly authenticated",
          );
        }
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
        throw new NotImplementedError(
          "Provider not supported for event creation yet",
        );
      }
    } catch (error) {
      next(error);
    }
  },
);

// =============================================================================
// iCloud Integration
// =============================================================================

/**
 * GET /calendar/icloud/status
 * Check if user has iCloud connected
 */
router.get(
  "/icloud/status",
  authenticateUser,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthRequest).user!.userId;

      const account =
        await calendarAccountRepository.findByProviderAndPrimaryUser(
          "icloud",
          userId,
        );

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
      next(error);
    }
  },
);

/**
 * DELETE /calendar/icloud/:userId
 * Remove iCloud connection
 */
router.delete(
  "/icloud/:userId",
  authenticateUser,
  validateUserId,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const primaryUserId = (req as AuthRequest).user!.userId;

      const deleted = await calendarAccountRepository.deleteByUserIdAndProvider(
        req.params.userId,
        "icloud",
        primaryUserId,
      );

      if (!deleted) {
        throw new NotFoundError("iCloud account not found");
      }

      res.json({ success: true, message: "iCloud account disconnected" });
    } catch (error) {
      next(error);
    }
  },
);

// =============================================================================
// Outlook Integration
// =============================================================================

/**
 * GET /calendar/outlook/status
 * Check if user has Outlook connected
 */
router.get(
  "/outlook/status",
  authenticateUser,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as AuthRequest).user!.userId;

      const account =
        await calendarAccountRepository.findByProviderAndPrimaryUser(
          "outlook",
          userId,
        );

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
      next(error);
    }
  },
);

/**
 * DELETE /calendar/outlook/:userId
 * Remove Outlook connection
 */
router.delete(
  "/outlook/:userId",
  authenticateUser,
  validateUserId,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const primaryUserId = (req as AuthRequest).user!.userId;

      const deleted = await calendarAccountRepository.deleteByUserIdAndProvider(
        req.params.userId,
        "outlook",
        primaryUserId,
      );

      if (!deleted) {
        throw new NotFoundError("Outlook account not found");
      }

      res.json({ success: true, message: "Outlook account disconnected" });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
