/**
 * AI routes - handles AI-powered features like invitation drafts
 */
import type { Response } from "express";
import express from "express";
import { aiService } from "../services/ai";
import { validateDraftInvitation } from "../middleware/validation";
import { authenticateUser } from "../middleware/auth";
import type { AuthRequest } from "../middleware/auth";
import { createRequestLogger, logError } from "../utils/logger";

const router = express.Router();

/**
 * POST /ai/draft-invitation
 * Generate an AI-powered invitation draft for a calendar event
 */
router.post(
  "/draft-invitation",
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
      const log = createRequestLogger({
        requestId: (req as AuthRequest & { requestId?: string }).requestId,
        method: req.method,
        path: req.path,
        userId: req.user?.userId,
      });
      logError(log, error, "Error generating invitation draft");
      const message =
        error instanceof Error
          ? error.message
          : "Failed to generate invitation draft";
      res.status(500).json({ error: message });
    }
  },
);

export default router;
