import type { Request, Response } from "express";
import express from "express";
import jwt from "jsonwebtoken";
import { URL } from "node:url";
import { validateICloudCredentials } from "../middleware/validation.js";
import { authenticateUser } from "../middleware/auth.js";
import type { AuthRequest } from "../middleware/auth.js";
import { env } from "../config/env.js";
import logger, { logError } from "../utils/logger.js";

// Import from shared core
import {
  googleAuthService,
  icloudAuthService,
  onecalAuthService,
  createAuthCode,
  exchangeAuthCode,
  JWT_COOKIE_MAX_AGE_MS,
  OUTLOOK_AUTH_COOKIE_MAX_AGE_MS,
  GOOGLE_AUTH_COOKIE_MAX_AGE_MS,
  COOKIE_SAME_SITE,
  COOKIE_NAMES,
} from "../../../shared/core/index.js";

const router = express.Router();

/**
 * Validate that a redirect URL is safe (matches allowed CLIENT_URL)
 * Prevents open redirect vulnerabilities
 */
function _isValidRedirectUrl(url: string): boolean {
  try {
    const redirectUrl = new URL(url);
    const allowedUrl = new URL(env.CLIENT_URL);
    return redirectUrl.origin === allowedUrl.origin;
  } catch {
    return false;
  }
}

/**
 * Build a safe redirect URL using the allowed CLIENT_URL origin
 */
function buildSafeRedirectUrl(
  path: string,
  params?: Record<string, string>,
): string {
  const url = new URL(env.CLIENT_URL);
  url.pathname = path || url.pathname;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }
  return url.toString();
}

// Interface for Outlook OAuth state token payload
interface OutlookStatePayload {
  userId: string;
  iat: number;
  exp: number;
}

router.get("/google", (req: Request, res: Response) => {
  // Generate a signed JWT state token for CSRF protection
  // This approach works across multiple server instances and survives restarts
  // since validation only requires the JWT_SECRET, no server-side storage needed
  const stateToken = jwt.sign({ type: "google_oauth" }, env.JWT_SECRET, {
    expiresIn: "10m", // 10 minutes - just for the auth flow
  });

  // Store the signed state token in a secure cookie
  // Note: Using sameSite: "lax" because the OAuth callback
  // is a cross-site navigation that requires the cookie to be sent.
  // The JWT-based state token provides additional CSRF protection.
  res.cookie(COOKIE_NAMES.GOOGLE_AUTH_STATE, stateToken, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: COOKIE_SAME_SITE,
    maxAge: GOOGLE_AUTH_COOKIE_MAX_AGE_MS,
  });

  const url = googleAuthService.getAuthUrl(stateToken);
  res.redirect(url);
});

router.get("/google/callback", async (req: Request, res: Response) => {
  const { code, state } = req.query;
  const stateToken = req.cookies?.[COOKIE_NAMES.GOOGLE_AUTH_STATE];

  // Clear the temporary cookie with matching options for reliable removal
  res.clearCookie(COOKIE_NAMES.GOOGLE_AUTH_STATE, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: COOKIE_SAME_SITE,
  });

  if (!code || typeof code !== "string") {
    res.status(400).send("Missing code");
    return;
  }

  // Validate state parameter to prevent CSRF attacks
  if (!state || typeof state !== "string" || !stateToken) {
    logError(
      logger,
      new Error("Missing state parameter or cookie"),
      "Google auth CSRF validation failed",
    );
    res.redirect(buildSafeRedirectUrl("/", { auth: "error", reason: "csrf" }));
    return;
  }

  // Verify the state token matches and is valid
  if (state !== stateToken) {
    logError(
      logger,
      new Error("State mismatch"),
      "Google auth CSRF validation failed",
    );
    res.redirect(buildSafeRedirectUrl("/", { auth: "error", reason: "csrf" }));
    return;
  }

  try {
    // Verify the JWT state token is valid (not expired, properly signed)
    jwt.verify(stateToken, env.JWT_SECRET);
  } catch (error) {
    logError(logger, error, "Google auth state token verification failed");
    res.redirect(buildSafeRedirectUrl("/", { auth: "error", reason: "csrf" }));
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
    res.cookie(COOKIE_NAMES.JWT_TOKEN, token, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: COOKIE_SAME_SITE,
      maxAge: JWT_COOKIE_MAX_AGE_MS,
    });

    // Create a short-lived exchange code instead of exposing userId in URL
    const authCode = createAuthCode({
      userId: result.user.id,
      email: result.user.email,
      provider: "google",
    });

    res.redirect(
      buildSafeRedirectUrl("/", { auth: "success", code: authCode }),
    );
  } catch (error) {
    logError(logger, error, "Google auth callback error");
    res.redirect(buildSafeRedirectUrl("/", { auth: "error" }));
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
      logError(logger, error, "iCloud auth error");
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
    res.cookie(COOKIE_NAMES.OUTLOOK_AUTH_STATE, stateToken, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: COOKIE_SAME_SITE,
      maxAge: OUTLOOK_AUTH_COOKIE_MAX_AGE_MS,
    });

    const url = onecalAuthService.getAuthUrl();
    res.redirect(url);
  } catch (error) {
    logError(logger, error, "Outlook auth initialization error");
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).send(`Outlook authentication failed: ${message}`);
  }
});

router.get("/outlook/callback", async (req: Request, res: Response) => {
  const { endUserAccountId } = req.query;
  const stateToken = req.cookies?.[COOKIE_NAMES.OUTLOOK_AUTH_STATE];

  // Clear the temporary cookie with matching options for reliable removal
  res.clearCookie(COOKIE_NAMES.OUTLOOK_AUTH_STATE, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: COOKIE_SAME_SITE,
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
        logError(logger, err, "Outlook JWT verification failed: Token expired");
      } else if (err instanceof jwt.JsonWebTokenError) {
        logError(logger, err, "Outlook JWT verification failed: Invalid token");
      } else {
        logError(logger, err, "Outlook JWT verification failed: Unknown error");
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
      buildSafeRedirectUrl("/", {
        auth: "success",
        provider: "outlook",
        code: authCode,
      }),
    );
  } catch (error) {
    logError(logger, error, "Outlook callback error");
    const message = error instanceof Error ? error.message : "Unknown error";
    res
      .status(500)
      .send(
        `Outlook authentication failed: ${message}\n\nCheck server console for details.`,
      );
  }
});

/**
 * POST /auth/logout
 * Sign out the current user by clearing the JWT cookie
 */
router.post("/logout", (_req: Request, res: Response) => {
  // Clear the JWT cookie
  res.clearCookie(COOKIE_NAMES.JWT_TOKEN, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: COOKIE_SAME_SITE,
  });

  res.json({ success: true, message: "Logged out successfully" });
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
      res.clearCookie(COOKIE_NAMES.JWT_TOKEN, {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: COOKIE_SAME_SITE,
      });

      res.json({ success: true, message: "Account successfully revoked" });
    } catch (error) {
      logError(logger, error, "Account revoke error");
      const message =
        error instanceof Error ? error.message : "Failed to revoke account";
      res.status(500).json({ error: message });
    }
  },
);

export default router;
