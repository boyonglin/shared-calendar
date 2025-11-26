/**
 * Calendar routes - handles calendar events and provider integrations
 */
import type { Request, Response } from "express";
import express from "express";
import { googleAuthService } from "../services/googleAuth";
import { icloudAuthService } from "../services/icloudAuth";
import { onecalAuthService } from "../services/onecalAuth";
import { db } from "../db";
import {
  validateUserId,
  validatePrimaryUserId,
  validateCreateEvent,
} from "../middleware/validation";
import { authenticateUser } from "../middleware/auth";
import type { AuthRequest } from "../middleware/auth";

const router = express.Router();

// =============================================================================
// Types
// =============================================================================

interface CalendarAccount {
  user_id: string;
  provider: string;
  external_email?: string;
  metadata?: string;
  access_token?: string;
  refresh_token?: string;
}

interface DBResult {
  changes: number;
}

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
  async (req: Request, res: Response) => {
    try {
      const primaryUserId = (req as AuthRequest).user!.userId;

      // Validate time parameters
      const timeMinResult = parseDateParam(req.query.timeMin);
      if (!timeMinResult.valid) {
        res.status(400).json({ error: "Invalid timeMin parameter" });
        return;
      }
      const timeMaxResult = parseDateParam(req.query.timeMax);
      if (!timeMaxResult.valid) {
        res.status(400).json({ error: "Invalid timeMax parameter" });
        return;
      }

      const timeMin = timeMinResult.date || undefined;
      const timeMax = timeMaxResult.date || undefined;

      // Get all calendar accounts linked to this primary user
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

/**
 * GET /calendar/:userId/events
 * Fetch events for a specific user account
 */
router.get(
  "/:userId/events",
  validateUserId,
  async (req: Request, res: Response) => {
    try {
      // Validate time parameters
      const timeMinResult = parseDateParam(req.query.timeMin);
      if (!timeMinResult.valid) {
        res.status(400).json({ error: "Invalid timeMin parameter" });
        return;
      }
      const timeMaxResult = parseDateParam(req.query.timeMax);
      if (!timeMaxResult.valid) {
        res.status(400).json({ error: "Invalid timeMax parameter" });
        return;
      }

      const timeMin = timeMinResult.date || undefined;
      const timeMax = timeMaxResult.date || undefined;

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

      const events = await fetchEventsFromProvider(
        { ...account, user_id: req.params.userId },
        timeMin,
        timeMax,
      );

      if (
        events.length === 0 &&
        !["google", "icloud", "outlook"].includes(account.provider)
      ) {
        res.status(400).json({ error: "Unsupported provider" });
        return;
      }

      res.json(events);
    } catch (error: unknown) {
      console.error("Error fetching events:", error);

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

/**
 * POST /calendar/events
 * Create a new calendar event
 */
router.post(
  "/events",
  authenticateUser,
  validateCreateEvent,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as AuthRequest).user!.userId;
      const { title, description, start, end, attendees, isAllDay } = req.body;

      // Check provider
      const stmt = db.prepare(
        "SELECT provider, access_token, refresh_token FROM calendar_accounts WHERE user_id = ?",
      );
      const account = stmt.get(userId) as CalendarAccount | undefined;

      if (!account) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      if (account.provider === "google") {
        if (!account.access_token) {
          res
            .status(401)
            .json({ error: "Google account not properly authenticated" });
          return;
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
          {
            access_token: account.access_token,
            refresh_token: account.refresh_token,
          },
        );
        res.json(event);
      } else {
        res
          .status(501)
          .json({ error: "Provider not supported for event creation yet" });
      }
    } catch (error) {
      console.error(
        "Error creating event:",
        error instanceof Error ? error.message : "Unknown error",
      );
      res.status(500).json({ error: "Failed to create event" });
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
  (req: Request, res: Response) => {
    try {
      const userId = (req as AuthRequest).user!.userId;

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

/**
 * DELETE /calendar/icloud/:userId
 * Remove iCloud connection
 */
router.delete(
  "/icloud/:userId",
  authenticateUser,
  validateUserId,
  (req: Request, res: Response) => {
    try {
      const primaryUserId = (req as AuthRequest).user!.userId;

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
  (req: Request, res: Response) => {
    try {
      const userId = (req as AuthRequest).user!.userId;

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

/**
 * DELETE /calendar/outlook/:userId
 * Remove Outlook connection
 */
router.delete(
  "/outlook/:userId",
  authenticateUser,
  validateUserId,
  (req: Request, res: Response) => {
    try {
      const primaryUserId = (req as AuthRequest).user!.userId;

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

export default router;
