/**
 * AI routes - handles AI-powered features like invitation drafts
 */
import type { Response, NextFunction } from "express";
import express from "express";
import { validateDraftInvitation } from "../middleware/validation.js";
import { authenticateUser } from "../middleware/auth.js";
import type { AuthRequest } from "../middleware/auth.js";

// Import from shared core
import { aiService } from "../../../shared/core/index.js";

const router = express.Router();

/**
 * POST /ai/draft-invitation
 * Generate an AI-powered invitation draft for a calendar event
 */
router.post(
  "/draft-invitation",
  authenticateUser,
  validateDraftInvitation,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
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
      next(error);
    }
  },
);

export default router;
