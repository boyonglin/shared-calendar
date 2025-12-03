/**
 * User routes - handles user profile operations
 */
import type { Request, Response } from "express";
import express from "express";
import { validateUserIdParam } from "../middleware/validation.js";
import { createRequestLogger, logError } from "../utils/logger.js";

// Import from shared core
import { googleAuthService } from "../../../shared/core/index.js";

const router = express.Router();

/**
 * GET /users/:id - Get user profile by ID
 */
router.get("/:id", validateUserIdParam, async (req: Request, res: Response) => {
  try {
    const user = await googleAuthService.getUser(req.params.id);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(user);
  } catch (error) {
    const log = createRequestLogger({ method: req.method, path: req.path });
    logError(log, error, "Error fetching user");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
