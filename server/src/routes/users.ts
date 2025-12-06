/**
 * User routes - handles user profile operations
 */
import type { Request, Response } from "express";
import express from "express";
import { authenticateUser } from "../middleware/auth.js";
import type { AuthRequest } from "../middleware/auth.js";
import { validateUserIdParam } from "../middleware/validation.js";
import { createRequestLogger, logError } from "../utils/logger.js";

// Import from shared core
import { googleAuthService } from "../../../shared/core/index.js";

const router = express.Router();

/**
 * GET /users/me - Get current authenticated user's profile
 * More convenient endpoint that doesn't require knowing the user ID
 */
router.get("/me", authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user!.userId;
    const user = await googleAuthService.getUser(userId);
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

/**
 * GET /users/:id - Get user profile by ID
 * Requires authentication - users can only access their own profile
 */
router.get(
  "/:id",
  authenticateUser,
  validateUserIdParam,
  async (req: Request, res: Response) => {
    try {
      const authenticatedUserId = (req as AuthRequest).user!.userId;
      const requestedUserId = req.params.id;

      // Users can only access their own profile
      if (requestedUserId !== authenticatedUserId) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      const user = await googleAuthService.getUser(requestedUserId);
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
  },
);

export default router;
