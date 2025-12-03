import type { Request, Response } from "express";
import express from "express";
import jwt from "jsonwebtoken";
import { validateICloudCredentials } from "../middleware/validation";
import { authenticateUser } from "../middleware/auth";
import type { AuthRequest } from "../middleware/auth";
import { env } from "../config/env";

// Import from shared core
import {
  googleAuthService,
  icloudAuthService,
  onecalAuthService,
  createAuthCode,
  exchangeAuthCode,
  generateOAuthState,
  validateOAuthState,
  JWT_COOKIE_MAX_AGE_MS,
  OUTLOOK_AUTH_COOKIE_MAX_AGE_MS,
  GOOGLE_AUTH_COOKIE_MAX_AGE_MS,
} from "../../../shared/core";

const router = express.Router();

// Interface for Outlook OAuth state token payload
interface OutlookStatePayload {
  userId: string;
  iat: number;
  exp: number;
}

router.get("/google", (req: Request, res: Response) => {
  // Generate a secure state token for CSRF protection
  const state = generateOAuthState();

  // Store the state in a secure, HTTP-only cookie
  res.cookie("google_auth_state", state, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: GOOGLE_AUTH_COOKIE_MAX_AGE_MS,
  });

  const url = googleAuthService.getAuthUrl(state);
  res.redirect(url);
});

router.get("/google/callback", async (req: Request, res: Response) => {
  const { code, state: stateFromQuery, error } = req.query;
  const stateFromCookie = req.cookies?.google_auth_state;

  // Clear the state cookie regardless of outcome
  res.clearCookie("google_auth_state", {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
  });

  if (error) {
    console.error("OAuth error from Google:", error);
    res.redirect(
      `${env.CLIENT_URL}?auth=error&message=${encodeURIComponent(String(error))}`,
    );
    return;
  }

  // Validate state parameter to prevent CSRF attacks
  if (
    !stateFromQuery ||
    typeof stateFromQuery !== "string" ||
    stateFromQuery !== stateFromCookie
  ) {
    console.error("OAuth state mismatch - possible CSRF attack");
    res.redirect(`${env.CLIENT_URL}?auth=error&message=invalid_state`);
    return;
  }

  // Validate and consume the state token (single-use)
  if (!validateOAuthState(stateFromQuery)) {
    console.error("OAuth state expired or already used");
    res.redirect(`${env.CLIENT_URL}?auth=error&message=expired_state`);
    return;
  }

  if (!code || typeof code !== "string") {
    res.redirect(`${env.CLIENT_URL}?auth=error&message=missing_code`);
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

    // Set JWT as HTTP-only cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: JWT_COOKIE_MAX_AGE_MS,
    });

    // Create a short-lived exchange code instead of exposing userId in URL
    const authCode = createAuthCode({
      userId: result.user.id,
      email: result.user.email,
      provider: "google",
    });

    res.redirect(`${env.CLIENT_URL}?auth=success&code=${authCode}`);
  } catch (error) {
    console.error("Auth error:", error);
    res.redirect(`${env.CLIENT_URL}?auth=error`);
  }
});

/**
 * POST /auth/exchange
 * Exchange a short-lived auth code for user data
 */
router.post("/exchange", (req: Request, res: Response) => {
  const { code } = req.body;

  if (!code || typeof code !== "string") {
    res.status(400).json({ error: "Missing code" });
    return;
  }

  const authData = exchangeAuthCode(code);

  if (!authData) {
    res.status(400).json({ error: "Invalid or expired code" });
    return;
  }

  // Return the user data - the client can then fetch full profile
  res.json({
    userId: authData.userId,
    email: authData.email,
    provider: authData.provider,
  });
});

/**
 * GET /auth/me
 * Verify current session and return user info from JWT
 * Used to restore session on app startup (especially for PWA)
 */
router.get("/me", authenticateUser, async (req: Request, res: Response) => {
  const { userId, email } = (req as AuthRequest).user!;

  try {
    // Try to fetch full user profile from database
    const user = await googleAuthService.getUser(userId);

    if (user) {
      res.json({
        id: user.profile.sub,
        email: user.profile.email,
        name: user.profile.name,
        picture: user.profile.picture,
      });
    } else {
      // User exists in JWT but not in DB - return basic info
      res.json({ id: userId, email });
    }
  } catch {
    // Fallback to JWT data if DB query fails
    res.json({ id: userId, email });
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

    // Generate a signed JWT state token that contains the user ID
    // This approach works across multiple server instances and survives restarts
    // since validation only requires the JWT_SECRET, no server-side storage needed
    const stateToken = jwt.sign({ userId: primaryUserId }, env.JWT_SECRET, {
      expiresIn: "10m", // 10 minutes - just for the auth flow
    });

    // Store the signed state token in a secure cookie
    // Note: Using sameSite: "lax" instead of "strict" because the OAuth callback
    // is a cross-site navigation that requires the cookie to be sent.
    // The JWT-based state token provides additional CSRF protection.
    res.cookie("outlook_auth_state", stateToken, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: OUTLOOK_AUTH_COOKIE_MAX_AGE_MS,
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
  const stateToken = req.cookies?.outlook_auth_state;

  // Clear the temporary cookie with matching options for reliable removal
  res.clearCookie("outlook_auth_state", {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
  });

  if (!endUserAccountId || typeof endUserAccountId !== "string") {
    res.status(400).send("Missing endUserAccountId from OneCal callback");
    return;
  }

  // Validate the signed state token and extract the user ID
  let primaryUserId: string | undefined;
  if (stateToken) {
    try {
      const payload = jwt.verify(
        stateToken,
        env.JWT_SECRET,
      ) as OutlookStatePayload;
      primaryUserId = payload.userId;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        console.error("JWT verification failed: Token expired", err);
      } else if (err instanceof jwt.JsonWebTokenError) {
        console.error("JWT verification failed: Invalid token", err);
      } else {
        console.error("JWT verification failed: Unknown error", err);
      }
      // Token is invalid or expired - primaryUserId remains undefined
    }
  }

  if (!primaryUserId) {
    res.status(400).send("Invalid or expired authentication state");
    return;
  }

  try {
    const result = await onecalAuthService.handleCallback(
      endUserAccountId,
      primaryUserId,
    );

    // Create a short-lived exchange code instead of exposing userId in URL
    const authCode = createAuthCode({
      userId: result.user.id,
      email: result.user.email,
      provider: "outlook",
    });

    // Redirect back to client with success - provider=outlook tells client
    // NOT to treat this as a login, just as a connection
    res.redirect(
      `${env.CLIENT_URL}?auth=success&provider=outlook&code=${authCode}`,
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

/**
 * DELETE /auth/revoke
 * Revoke Google authorization and delete all user data
 */
router.delete(
  "/revoke",
  authenticateUser,
  async (req: Request, res: Response) => {
    const userId = (req as AuthRequest).user!.userId;

    try {
      await googleAuthService.revokeAccount(userId);

      // Clear the JWT cookie
      res.clearCookie("token", {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "strict",
      });

      res.json({ success: true, message: "Account successfully revoked" });
    } catch (error) {
      console.error("Revoke error:", error);
      const message =
        error instanceof Error ? error.message : "Failed to revoke account";
      res.status(500).json({ error: message });
    }
  },
);

export default router;
