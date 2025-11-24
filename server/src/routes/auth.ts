import type { Request, Response } from "express";
import express from "express";
import { googleAuthService } from "../services/googleAuth";
import { icloudAuthService } from "../services/icloudAuth";
import { onecalAuthService } from "../services/onecalAuth";
import { validateICloudCredentials } from "../middleware/validation";
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

    // Redirect back to client with success
    // In a real app, we'd probably set a session cookie here
    // For now, we'll redirect to the client app with a query param indicating success
    // The client can then fetch the user status
    res.redirect(`${env.CLIENT_URL}?auth=success&userId=${result.user.id}`);
  } catch (error) {
    console.error("Auth error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    res
      .status(500)
      .send(
        `Authentication failed: ${message}\n\nCheck server console for details.`,
      );
  }
});

router.post(
  "/icloud",
  validateICloudCredentials,
  async (req: Request, res: Response) => {
    const { email, password } = req.body;

    try {
      const result = await icloudAuthService.verifyCredentials(email, password);
      res.json(result);
    } catch (error) {
      console.error("iCloud auth error:", error);
      const message =
        error instanceof Error ? error.message : "Authentication failed";
      res.status(401).json({ error: message });
    }
  },
);

// Outlook/Microsoft OAuth via OneCal
router.get("/outlook", (req: Request, res: Response) => {
  try {
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

  if (!endUserAccountId || typeof endUserAccountId !== "string") {
    res.status(400).send("Missing endUserAccountId from OneCal callback");
    return;
  }

  try {
    const result = await onecalAuthService.handleCallback(endUserAccountId);

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
