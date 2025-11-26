/**
 * User routes - handles user profile operations
 */
import type { Request, Response } from "express";
import express from "express";
import { googleAuthService } from "../services/googleAuth";
import { validateUserIdParam } from "../middleware/validation";

const router = express.Router();

/**
 * GET /users/:id - Get user profile by ID
 */
router.get("/:id", validateUserIdParam, (req: Request, res: Response) => {
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

export default router;
