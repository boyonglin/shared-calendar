import type { Request, Response } from "express";
import express from "express";
import jwt from "jsonwebtoken";
import { googleAuthService } from "../services/googleAuth";
import { icloudAuthService } from "../services/icloudAuth";
import { onecalAuthService } from "../services/onecalAuth";
import { validateICloudCredentials } from "../middleware/validation";
import { authenticateUser } from "../middleware/auth";
import type { AuthRequest } from "../middleware/auth";
import { env } from "../config/env";

const router = express.Router();

router.get("/google", (req: Request, res: Response) => {
  const url = googleAuthService.getAuthUrl();
  res.redirect(url);
});

router.get("/google/callback", async (req: Request, res: Response) => {
  const { code } = req.query;

  if (!code || typeof code !== "string") {
    res.status(400).send("Missing code");
    return;
  }

  try {
    const result = await googleAuthService.handleCallback(code);

    // Generate JWT token
    const token = jwt.sign(
      { userId: result.user.id, email: result.user.email },
      env.JWT_SECRET,
      { expiresIn: "30d" },
    );

    // Set JWT as HTTP-only cookie and redirect back to client with success
    res.cookie("token", token, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });
    res.redirect(`${env.CLIENT_URL}?auth=success&userId=${result.user.id}`);
  } catch (error) {
    console.error("Auth error:", error);
    res.redirect(`${env.CLIENT_URL}?auth=error`);
  }
});

router.post(
  "/icloud",
  authenticateUser,
  validateICloudCredentials,
  async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const primaryUserId = (req as AuthRequest).user!.userId;

    try {
      const result = await icloudAuthService.verifyCredentials(
        email,
        password,
        primaryUserId,
      );
      if (!result?.user?.id) {
        res
          .status(500)
          .json({ error: "Invalid response from iCloud authentication" });
        return;
      }
      const token = jwt.sign(
        { userId: result.user.id, email: result.user.email },
        env.JWT_SECRET,
        { expiresIn: "30d" },
      );
      res.json({ ...result, token });
    } catch (error) {
      console.error("iCloud auth error:", error);
      const message =
        error instanceof Error ? error.message : "Authentication failed";
      res.status(401).json({ error: message });
    }
  },
);

// Outlook/Microsoft OAuth via OneCal
router.get("/outlook", authenticateUser, (req: Request, res: Response) => {
  try {
    const primaryUserId = (req as AuthRequest).user!.userId;

    // Store primary user ID in a cookie to retrieve in callback
    res.cookie("outlook_primary_user", primaryUserId, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 10 * 60 * 1000, // 10 minutes - just for the auth flow
    });

    const url = onecalAuthService.getAuthUrl();
    res.redirect(url);
  } catch (error) {
    console.error("Outlook auth error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).send(`Outlook authentication failed: ${message}`);
  }
});

router.get("/outlook/callback", async (req: Request, res: Response) => {
  const { endUserAccountId } = req.query;
  const primaryUserId = req.cookies?.outlook_primary_user;

  // Clear the temporary cookie
  res.clearCookie("outlook_primary_user");

  if (!endUserAccountId || typeof endUserAccountId !== "string") {
    res.status(400).send("Missing endUserAccountId from OneCal callback");
    return;
  }

  try {
    const result = await onecalAuthService.handleCallback(
      endUserAccountId,
      primaryUserId,
    );

    // Redirect back to client with success - importantly with provider=outlook
    // This tells the client NOT to treat this as a login, just as a connection
    res.redirect(
      `${env.CLIENT_URL}?auth=success&provider=outlook&outlookUserId=${result.user.id}`,
    );
  } catch (error) {
    console.error("Outlook callback error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    res
      .status(500)
      .send(
        `Outlook authentication failed: ${message}\n\nCheck server console for details.`,
      );
  }
});

export default router;
