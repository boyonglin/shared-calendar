/**
 * Vercel Serverless Function Entry Point
 *
 * This file now uses the shared core for all business logic,
 * making it much simpler and ensuring consistency with the local server.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import jwt from "jsonwebtoken";

// Import everything from shared core
import {
  // Database
  ensureDbInitialized,
  healthCheck,
  // Repositories
  calendarAccountRepository,
  userConnectionRepository,
  // Services
  googleAuthService,
  icloudAuthService,
  onecalAuthService,
  aiService,
  // Utilities
  createAuthCode,
  exchangeAuthCode,
  isValidEmail,
  parseDateParam,
  generateFriendColor,
  extractFriendName,
  validateTone,
  // Constants
  JWT_COOKIE_MAX_AGE_MS,
  OUTLOOK_AUTH_COOKIE_MAX_AGE_MS,
} from "../shared/core/index.js";

// =============================================================================
// Environment Variables
// =============================================================================
const JWT_SECRET = process.env.JWT_SECRET || "default-secret-change-me";
const CLIENT_URL =
  process.env.CLIENT_URL || "https://shared-calendar-vibe.vercel.app";

// =============================================================================
// JWT Helpers
// =============================================================================
interface JwtPayload {
  userId: string;
  email?: string;
}

function verifyToken(req: VercelRequest): JwtPayload | null {
  const cookieHeader = req.headers.cookie || "";
  const tokenMatch = cookieHeader.match(/token=([^;]+)/);
  const token = tokenMatch?.[1];

  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  const finalToken = token || bearerToken;
  if (!finalToken) return null;

  try {
    return jwt.verify(finalToken, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

// =============================================================================
// Route Handlers
// =============================================================================

async function handleGoogleAuth(res: VercelResponse) {
  const url = googleAuthService.getAuthUrl();
  return res.redirect(url);
}

async function handleGoogleCallback(
  req: VercelRequest,
  res: VercelResponse,
): Promise<VercelResponse> {
  const code = req.query.code as string;
  const error = req.query.error as string;

  if (error) {
    return res.redirect(
      `${CLIENT_URL}?auth=error&message=${encodeURIComponent(error)}`,
    );
  }

  if (!code) {
    return res.redirect(`${CLIENT_URL}?auth=error&message=missing_code`);
  }

  try {
    const result = await googleAuthService.handleCallback(code);

    if (!result.user.email) {
      return res.redirect(`${CLIENT_URL}?auth=error&message=email_required`);
    }

    const token = jwt.sign(
      { userId: result.user.id, email: result.user.email },
      JWT_SECRET,
      { expiresIn: "30d" },
    );

    res.setHeader(
      "Set-Cookie",
      `token=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${JWT_COOKIE_MAX_AGE_MS / 1000}`,
    );

    const authCode = createAuthCode({
      userId: result.user.id,
      email: result.user.email,
      provider: "google",
    });

    return res.redirect(`${CLIENT_URL}?auth=success&code=${authCode}`);
  } catch (err) {
    console.error("Google callback error:", err);
    const message = err instanceof Error ? err.message : "unknown_error";
    return res.redirect(
      `${CLIENT_URL}?auth=error&message=${encodeURIComponent(message)}`,
    );
  }
}

async function handleAuthExchange(
  req: VercelRequest,
  res: VercelResponse,
): Promise<VercelResponse> {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const { code } = req.body || {};
  if (!code) {
    return res.status(400).json({ error: "Missing code" });
  }
  const authData = exchangeAuthCode(code);
  if (!authData) {
    return res.status(400).json({ error: "Invalid or expired code" });
  }
  return res.status(200).json({
    userId: authData.userId,
    email: authData.email,
    provider: authData.provider,
  });
}

/**
 * GET /auth/me
 * Verify current session and return user info from JWT
 * Used to restore session on app startup (especially for PWA)
 */
async function handleAuthMe(
  req: VercelRequest,
  res: VercelResponse,
): Promise<VercelResponse> {
  const user = verifyToken(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Try to fetch full user profile from database
    const dbUser = await googleAuthService.getUser(user.userId);

    if (dbUser) {
      return res.status(200).json({
        id: dbUser.profile.sub,
        email: dbUser.profile.email,
        name: dbUser.profile.name,
        picture: dbUser.profile.picture,
      });
    } else {
      // User exists in JWT but not in DB - return basic info
      return res.status(200).json({ id: user.userId, email: user.email });
    }
  } catch {
    // Fallback to JWT data if DB query fails
    return res.status(200).json({ id: user.userId, email: user.email });
  }
}

async function handleGetUser(
  userId: string,
  res: VercelResponse,
): Promise<VercelResponse> {
  const user = await googleAuthService.getUser(userId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  return res.status(200).json(user);
}

async function handleGetAllEvents(
  req: VercelRequest,
  res: VercelResponse,
  userId: string,
): Promise<VercelResponse> {
  const user = verifyToken(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const queryString = req.url?.split("?")[1] || "";
  const params = new URLSearchParams(queryString);
  const timeMin = parseDateParam(params.get("timeMin")) || new Date();
  const timeMax =
    parseDateParam(params.get("timeMax")) ||
    new Date(Date.now() + 28 * 24 * 60 * 60 * 1000);

  const accounts = await calendarAccountRepository.findByPrimaryUserId(userId);

  if (accounts.length === 0) {
    return res.status(200).json([]);
  }

  const allEvents: Array<Record<string, unknown>> = [];

  for (const account of accounts) {
    try {
      let events;
      if (account.provider === "google") {
        events = await googleAuthService.getCalendarEvents(
          account.user_id,
          timeMin,
          timeMax,
        );
      } else if (account.provider === "icloud") {
        events = await icloudAuthService.getCalendarEvents(
          account.user_id,
          timeMin,
          timeMax,
        );
      } else if (account.provider === "outlook") {
        events = await onecalAuthService.getCalendarEvents(
          account.user_id,
          timeMin,
          timeMax,
        );
      }

      if (events) {
        const taggedEvents = (events as Array<Record<string, unknown>>).map(
          (event) => ({
            ...event,
            accountType: account.provider,
            accountEmail: account.external_email,
            userId: account.user_id,
          }),
        );
        allEvents.push(...taggedEvents);
      }
    } catch (err) {
      console.error(
        `Error fetching ${account.provider} events for ${account.user_id}:`,
        err,
      );
    }
  }

  return res.status(200).json(allEvents);
}

async function handleStreamEvents(
  req: VercelRequest,
  res: VercelResponse,
  userId: string,
): Promise<void> {
  const user = verifyToken(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const queryString = req.url?.split("?")[1] || "";
  const params = new URLSearchParams(queryString);
  const timeMin = parseDateParam(params.get("timeMin")) || new Date();
  const timeMax =
    parseDateParam(params.get("timeMax")) ||
    new Date(Date.now() + 28 * 24 * 60 * 60 * 1000);

  const accounts = await calendarAccountRepository.findByPrimaryUserId(userId);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const sendEvent = (data: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  if (accounts.length === 0) {
    sendEvent({ type: "complete", events: [] });
    res.end();
    return;
  }

  const fetchPromises = accounts.map(async (account) => {
    try {
      let events;
      if (account.provider === "google") {
        events = await googleAuthService.getCalendarEvents(
          account.user_id,
          timeMin,
          timeMax,
        );
      } else if (account.provider === "icloud") {
        events = await icloudAuthService.getCalendarEvents(
          account.user_id,
          timeMin,
          timeMax,
        );
      } else if (account.provider === "outlook") {
        events = await onecalAuthService.getCalendarEvents(
          account.user_id,
          timeMin,
          timeMax,
        );
      }

      if (events) {
        const taggedEvents = (events as Array<Record<string, unknown>>).map(
          (event) => ({
            ...event,
            accountType: account.provider,
            accountEmail: account.external_email,
            userId: account.user_id,
          }),
        );
        sendEvent({
          type: "events",
          provider: account.provider,
          events: taggedEvents,
        });
      }
    } catch (err) {
      console.error(
        `Error fetching ${account.provider} events for ${account.user_id}:`,
        err,
      );
      sendEvent({
        type: "error",
        provider: account.provider,
        message: `Failed to fetch ${account.provider} events`,
      });
    }
  });

  await Promise.all(fetchPromises);
  sendEvent({ type: "complete" });
  res.end();
}

async function handleCreateEvent(
  req: VercelRequest,
  res: VercelResponse,
): Promise<VercelResponse> {
  const user = verifyToken(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { title, description, start, end, attendees, isAllDay } =
    req.body || {};

  if (!title || !start || !end) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const account = await calendarAccountRepository.findByUserId(user.userId);
  if (!account) {
    return res.status(404).json({ error: "User not found" });
  }

  if (account.provider !== "google") {
    return res.status(400).json({ error: "Only Google calendar supported" });
  }

  const event = await googleAuthService.createEvent(
    user.userId,
    {
      summary: title,
      description,
      start: isAllDay ? { date: start } : { dateTime: start },
      end: isAllDay ? { date: end } : { dateTime: end },
      attendees: attendees?.map((email: string) => ({ email })),
    },
    account,
  );

  return res.status(200).json(event);
}

async function handleICloudConnect(
  req: VercelRequest,
  res: VercelResponse,
): Promise<VercelResponse> {
  const user = verifyToken(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { email, password } = req.body || {};

  if (
    !email ||
    typeof email !== "string" ||
    !email.includes("@") ||
    email.length > 255
  ) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  if (
    !password ||
    typeof password !== "string" ||
    password.length < 1 ||
    password.length > 1000
  ) {
    return res.status(400).json({ error: "Invalid password format" });
  }

  try {
    const result = await icloudAuthService.verifyCredentials(
      email,
      password,
      user.userId,
    );
    return res.status(200).json(result);
  } catch (error) {
    console.error("iCloud auth error:", error);
    const message =
      error instanceof Error ? error.message : "Authentication failed";
    return res.status(401).json({ error: message });
  }
}

async function handleICloudStatus(
  req: VercelRequest,
  res: VercelResponse,
): Promise<VercelResponse> {
  const user = verifyToken(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const account = await calendarAccountRepository.findByProviderAndPrimaryUser(
    "icloud",
    user.userId,
  );

  if (!account) {
    return res.status(200).json({ connected: false });
  }

  return res.status(200).json({
    connected: true,
    email: account.external_email,
    userId: account.user_id,
  });
}

async function handleRemoveICloud(
  req: VercelRequest,
  res: VercelResponse,
  userId: string,
): Promise<VercelResponse> {
  const user = verifyToken(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  await calendarAccountRepository.deleteByUserIdAndProvider(
    userId,
    "icloud",
    user.userId,
  );

  return res.status(200).json({ success: true });
}

async function handleOutlookAuth(
  req: VercelRequest,
  res: VercelResponse,
): Promise<VercelResponse | void> {
  const user = verifyToken(req);
  if (!user) {
    return res
      .status(401)
      .json({ error: "Unauthorized - please sign in first" });
  }

  const stateToken = jwt.sign({ userId: user.userId }, JWT_SECRET, {
    expiresIn: "10m",
  });

  res.setHeader(
    "Set-Cookie",
    `outlook_auth_state=${stateToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${OUTLOOK_AUTH_COOKIE_MAX_AGE_MS / 1000}`,
  );

  const url = onecalAuthService.getAuthUrl();
  return res.redirect(url);
}

async function handleOutlookCallback(
  req: VercelRequest,
  res: VercelResponse,
): Promise<VercelResponse> {
  const { endUserAccountId } = req.query;

  const cookieHeader = req.headers.cookie || "";
  const stateMatch = cookieHeader.match(/outlook_auth_state=([^;]+)/);
  const stateToken = stateMatch?.[1];

  res.setHeader(
    "Set-Cookie",
    "outlook_auth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0",
  );

  if (!endUserAccountId || typeof endUserAccountId !== "string") {
    return res.redirect(
      `${CLIENT_URL}?auth=error&message=missing_endUserAccountId`,
    );
  }

  let primaryUserId: string | undefined;
  if (stateToken) {
    try {
      const payload = jwt.verify(stateToken, JWT_SECRET) as { userId: string };
      primaryUserId = payload.userId;
    } catch (err) {
      console.error("JWT verification failed:", err);
    }
  }

  if (!primaryUserId) {
    return res.redirect(
      `${CLIENT_URL}?auth=error&message=invalid_or_expired_state`,
    );
  }

  try {
    const result = await onecalAuthService.handleCallback(
      endUserAccountId,
      primaryUserId,
    );

    const authCode = createAuthCode({
      userId: result.user.id,
      email: result.user.email,
      provider: "outlook",
    });

    return res.redirect(
      `${CLIENT_URL}?auth=success&provider=outlook&code=${authCode}`,
    );
  } catch (error) {
    console.error("Outlook callback error:", error);
    const message = error instanceof Error ? error.message : "unknown_error";
    return res.redirect(
      `${CLIENT_URL}?auth=error&message=${encodeURIComponent(message)}`,
    );
  }
}

async function handleOutlookStatus(
  req: VercelRequest,
  res: VercelResponse,
): Promise<VercelResponse> {
  const user = verifyToken(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const account = await calendarAccountRepository.findByProviderAndPrimaryUser(
    "outlook",
    user.userId,
  );

  if (!account) {
    return res.status(200).json({ connected: false });
  }

  return res.status(200).json({
    connected: true,
    email: account.external_email,
    userId: account.user_id,
  });
}

async function handleRemoveOutlook(
  req: VercelRequest,
  res: VercelResponse,
  userId: string,
): Promise<VercelResponse> {
  const user = verifyToken(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  await calendarAccountRepository.deleteByUserIdAndProvider(
    userId,
    "outlook",
    user.userId,
  );

  return res.status(200).json({ success: true });
}

async function handleRevokeAccount(
  req: VercelRequest,
  res: VercelResponse,
): Promise<VercelResponse> {
  const user = verifyToken(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    await googleAuthService.revokeAccount(user.userId);

    res.setHeader(
      "Set-Cookie",
      `token=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`,
    );

    return res
      .status(200)
      .json({ success: true, message: "Account successfully revoked" });
  } catch (error) {
    console.error("Revoke account error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to revoke account";
    return res.status(500).json({ error: message });
  }
}

// =============================================================================
// Friends Handlers
// =============================================================================

async function handleGetFriends(
  req: VercelRequest,
  res: VercelResponse,
): Promise<VercelResponse> {
  const user = verifyToken(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const connections = await userConnectionRepository.findAllByUserId(
    user.userId,
  );

  const friends = connections.map((conn) => ({
    id: conn.id,
    userId: conn.user_id,
    friendEmail: conn.friend_email,
    friendUserId: conn.friend_user_id,
    friendName: extractFriendName(conn.metadata, conn.friend_email),
    friendColor: generateFriendColor(conn.friend_email),
    status: conn.status,
    createdAt: conn.created_at,
  }));

  return res.status(200).json({ friends });
}

async function handleGetIncomingRequests(
  req: VercelRequest,
  res: VercelResponse,
): Promise<VercelResponse> {
  const user = verifyToken(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const connections = await userConnectionRepository.findIncomingRequests(
    user.userId,
  );

  const requests = connections.map((conn) => ({
    id: conn.id,
    userId: conn.user_id,
    friendEmail: conn.friend_email,
    friendUserId: conn.friend_user_id,
    friendName: extractFriendName(conn.metadata, conn.friend_email),
    friendColor: generateFriendColor(conn.friend_email),
    status: conn.status,
    createdAt: conn.created_at,
  }));

  return res.status(200).json({ requests, count: requests.length });
}

async function handleSyncPending(
  req: VercelRequest,
  res: VercelResponse,
): Promise<VercelResponse> {
  const user = verifyToken(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const pendingConnections =
    await userConnectionRepository.findPendingWithoutFriendUserId(user.userId);

  let updatedCount = 0;

  for (const conn of pendingConnections) {
    const friendAccount = await calendarAccountRepository.findByExternalEmail(
      conn.friend_email,
    );

    if (friendAccount) {
      await userConnectionRepository.updateFriendUserIdAndStatus(
        conn.id,
        friendAccount.user_id,
        "requested",
      );

      const currentUser = await calendarAccountRepository.findByUserId(
        user.userId,
      );

      if (currentUser?.external_email) {
        const reverseExisting =
          await userConnectionRepository.findByUserIdAndFriendEmail(
            friendAccount.user_id,
            currentUser.external_email.toLowerCase(),
          );

        if (!reverseExisting) {
          await userConnectionRepository.create(
            friendAccount.user_id,
            currentUser.external_email.toLowerCase(),
            user.userId,
            "incoming",
          );
        }
      }
      updatedCount++;
    }
  }

  return res.status(200).json({
    success: true,
    message: `Synced ${updatedCount} pending connections`,
    updatedCount,
  });
}

async function handleAddFriend(
  req: VercelRequest,
  res: VercelResponse,
): Promise<VercelResponse> {
  const user = verifyToken(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { friendEmail } = req.body || {};

  if (!friendEmail || typeof friendEmail !== "string") {
    return res.status(400).json({ error: "Friend email is required" });
  }

  const normalizedEmail = friendEmail.toLowerCase().trim();

  if (!isValidEmail(normalizedEmail)) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  const userEmails =
    await calendarAccountRepository.findAllEmailsByPrimaryUserId(user.userId);

  if (userEmails.includes(normalizedEmail)) {
    return res
      .status(400)
      .json({ error: "You cannot add yourself as a friend" });
  }

  const existing = await userConnectionRepository.findByUserIdAndFriendEmail(
    user.userId,
    normalizedEmail,
  );

  if (existing) {
    const errorMessages: Record<string, string> = {
      accepted: "You are already friends",
      pending: "Friend request pending",
      requested: "Friend request pending",
      incoming: "You have a pending friend request from this user",
    };
    return res.status(409).json({
      error: errorMessages[existing.status] || "Friend request already sent",
    });
  }

  const friendAccount =
    await calendarAccountRepository.findByExternalEmail(normalizedEmail);

  const status = friendAccount ? "requested" : "pending";
  const friendUserId = friendAccount?.user_id || null;

  const primaryUserAccount = await calendarAccountRepository.findByUserId(
    user.userId,
  );

  try {
    await userConnectionRepository.create(
      user.userId,
      normalizedEmail,
      friendUserId,
      status,
    );

    if (friendAccount && primaryUserAccount?.external_email) {
      const reverseExisting =
        await userConnectionRepository.findByUserIdAndFriendEmail(
          friendAccount.user_id,
          primaryUserAccount.external_email.toLowerCase(),
        );

      if (!reverseExisting) {
        await userConnectionRepository.createOrIgnore(
          friendAccount.user_id,
          primaryUserAccount.external_email.toLowerCase(),
          user.userId,
          "incoming",
        );
      }
    }
  } catch (dbError: unknown) {
    if (
      dbError instanceof Error &&
      dbError.message.includes("UNIQUE constraint failed")
    ) {
      return res.status(409).json({ error: "Friend request already sent" });
    }
    throw dbError;
  }

  const connection = await userConnectionRepository.findByUserIdAndFriendEmail(
    user.userId,
    normalizedEmail,
  );

  if (!connection) {
    return res
      .status(500)
      .json({ error: "Failed to create friend connection" });
  }

  return res.status(201).json({
    success: true,
    connection: {
      id: connection.id,
      userId: connection.user_id,
      friendEmail: connection.friend_email,
      friendUserId: connection.friend_user_id,
      friendName: extractFriendName(friendAccount?.metadata, normalizedEmail),
      status: connection.status,
      createdAt: connection.created_at,
    },
    message:
      status === "requested"
        ? "Friend request sent! They need to accept it."
        : "Friend request sent. They will see it once they sign up.",
  });
}

async function handleRemoveFriend(
  req: VercelRequest,
  res: VercelResponse,
  friendId: number,
): Promise<VercelResponse> {
  const user = verifyToken(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const connection = await userConnectionRepository.findByIdAndUserId(
    friendId,
    user.userId,
  );

  if (!connection) {
    return res.status(404).json({ error: "Friend connection not found" });
  }

  await userConnectionRepository.deleteById(friendId);

  if (connection.friend_user_id) {
    const userAccount = await calendarAccountRepository.findByUserId(
      user.userId,
    );

    if (userAccount?.external_email) {
      await userConnectionRepository.deleteByUserIdAndFriendEmail(
        connection.friend_user_id,
        userAccount.external_email.toLowerCase(),
      );
    }
  }

  return res
    .status(200)
    .json({ success: true, message: "Friend removed successfully" });
}

async function handleAcceptFriend(
  req: VercelRequest,
  res: VercelResponse,
  friendId: number,
): Promise<VercelResponse> {
  const user = verifyToken(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const request = await userConnectionRepository.findByIdUserIdAndStatus(
    friendId,
    user.userId,
    "incoming",
  );

  if (!request) {
    return res.status(404).json({ error: "Friend request not found" });
  }

  await userConnectionRepository.updateStatus(friendId, "accepted");

  if (request.friend_user_id) {
    await userConnectionRepository.updateStatusByUserIdAndFriendUserId(
      request.friend_user_id,
      user.userId,
      "requested",
      "accepted",
    );
  }

  return res
    .status(200)
    .json({ success: true, message: "Friend request accepted!" });
}

async function handleRejectFriend(
  req: VercelRequest,
  res: VercelResponse,
  friendId: number,
): Promise<VercelResponse> {
  const user = verifyToken(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const request = await userConnectionRepository.findByIdUserIdAndStatus(
    friendId,
    user.userId,
    "incoming",
  );

  if (!request) {
    return res.status(404).json({ error: "Friend request not found" });
  }

  await userConnectionRepository.deleteById(friendId);

  if (request.friend_user_id) {
    await userConnectionRepository.deleteByUserIdAndFriendUserIdAndStatus(
      request.friend_user_id,
      user.userId,
      "requested",
    );
  }

  return res
    .status(200)
    .json({ success: true, message: "Friend request rejected" });
}

async function handleGetFriendEvents(
  req: VercelRequest,
  res: VercelResponse,
  friendId: number,
): Promise<VercelResponse> {
  const user = verifyToken(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const connection = await userConnectionRepository.findByIdUserIdAndStatus(
    friendId,
    user.userId,
    "accepted",
  );

  if (!connection || !connection.friend_user_id) {
    return res
      .status(404)
      .json({ error: "Friend not found or connection not accepted" });
  }

  const reverseConnection =
    await userConnectionRepository.findByUserIdAndFriendUserId(
      connection.friend_user_id,
      user.userId,
      "accepted",
    );

  if (!reverseConnection) {
    return res
      .status(404)
      .json({ error: "Friend not found or connection not mutually accepted" });
  }

  const queryString = req.url?.split("?")[1] || "";
  const params = new URLSearchParams(queryString);
  const timeMin = parseDateParam(params.get("timeMin")) || new Date();
  const timeMax =
    parseDateParam(params.get("timeMax")) ||
    new Date(Date.now() + 28 * 24 * 60 * 60 * 1000);

  const accounts = await calendarAccountRepository.findByPrimaryUserId(
    connection.friend_user_id,
  );

  const allEvents: Array<Record<string, unknown>> = [];
  const accountErrors: Array<{
    provider: string;
    error: string;
    needsReauth: boolean;
  }> = [];

  for (const account of accounts) {
    try {
      let events;
      if (account.provider === "google") {
        events = await googleAuthService.getCalendarEvents(
          account.user_id,
          timeMin,
          timeMax,
        );
      } else if (account.provider === "icloud") {
        events = await icloudAuthService.getCalendarEvents(
          account.user_id,
          timeMin,
          timeMax,
        );
      } else if (account.provider === "outlook") {
        events = await onecalAuthService.getCalendarEvents(
          account.user_id,
          timeMin,
          timeMax,
        );
      }

      if (events) {
        const taggedEvents = (events as Array<Record<string, unknown>>).map(
          (event) => ({
            ...event,
            userId: account.user_id,
            friendConnectionId: friendId,
          }),
        );
        allEvents.push(...taggedEvents);
      }
    } catch (error) {
      console.error(
        `Error fetching friend events from ${account.provider}:`,
        error,
      );
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const needsReauth =
        errorMessage.includes("invalid_grant") ||
        errorMessage.includes("Token has been expired or revoked") ||
        errorMessage.includes("Invalid Credentials");

      accountErrors.push({
        provider: account.provider,
        error: needsReauth
          ? "Friend needs to re-authenticate"
          : "Failed to fetch events",
        needsReauth,
      });
    }
  }

  return res.status(200).json({
    events: allEvents,
    errors: accountErrors,
  });
}

// =============================================================================
// AI Handlers
// =============================================================================

async function handleDraftInvitation(
  req: VercelRequest,
  res: VercelResponse,
): Promise<VercelResponse> {
  const user = verifyToken(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const {
    title,
    description,
    start,
    end,
    attendees,
    location,
    tone,
    geminiApiKey,
  } = req.body || {};

  if (!title || !start || !end) {
    return res
      .status(400)
      .json({ error: "Missing required fields (title, start, end)" });
  }

  if (typeof geminiApiKey !== "string" || geminiApiKey.trim().length === 0) {
    return res.status(400).json({ error: "Invalid Gemini API key format" });
  }

  const trimmedGeminiApiKey = geminiApiKey.trim();
  if (!/^[A-Za-z0-9_-]+$/.test(trimmedGeminiApiKey)) {
    return res
      .status(400)
      .json({ error: "Gemini API key contains invalid characters" });
  }

  const startDate = new Date(start);
  const endDate = new Date(end);
  if (
    isNaN(startDate.getTime()) ||
    isNaN(endDate.getTime()) ||
    !/T\d{2}:\d{2}/.test(start) ||
    !/T\d{2}:\d{2}/.test(end)
  ) {
    return res
      .status(400)
      .json({ error: "Invalid datetime format. Use ISO 8601 format." });
  }
  if (endDate < startDate) {
    return res
      .status(400)
      .json({ error: "End time must not be before start time" });
  }

  try {
    const draft = await aiService.generateInvitationDraft(
      {
        title,
        description,
        start,
        end,
        attendees,
        location,
      },
      validateTone(tone),
      trimmedGeminiApiKey,
    );

    return res.status(200).json({ draft });
  } catch (error) {
    console.error("Error generating invitation draft:", error);
    return res.status(500).json({
      error:
        "Failed to generate invitation draft. Please check your API key and try again.",
    });
  }
}

// =============================================================================
// Main Handler
// =============================================================================
export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<VercelResponse | void> {
  const rawPath = req.url?.split("?")[0] || "/api";

  let path = rawPath.replace(/\/$/, "");
  if (!path.startsWith("/api")) {
    path = `/api${path.startsWith("/") ? "" : "/"}${path}`;
  }

  // CORS
  res.setHeader("Access-Control-Allow-Origin", CLIENT_URL);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Cookie",
  );
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    await ensureDbInitialized();

    // Health check
    if (path === "/api/health") {
      const dbHealthy = await healthCheck();
      return res.status(dbHealthy ? 200 : 503).json({
        status: dbHealthy ? "ok" : "degraded",
        timestamp: new Date().toISOString(),
        environment: "vercel",
      });
    }

    // Auth routes
    if (path === "/api/auth/google") {
      return handleGoogleAuth(res);
    }
    if (path === "/api/auth/google/callback") {
      return handleGoogleCallback(req, res);
    }
    if (path === "/api/auth/exchange") {
      return handleAuthExchange(req, res);
    }
    if (path === "/api/auth/me" && req.method === "GET") {
      return handleAuthMe(req, res);
    }
    if (path === "/api/auth/outlook") {
      return handleOutlookAuth(req, res);
    }
    if (path === "/api/auth/outlook/callback") {
      return handleOutlookCallback(req, res);
    }
    if (path === "/api/auth/icloud" && req.method === "POST") {
      return handleICloudConnect(req, res);
    }
    if (path === "/api/auth/revoke" && req.method === "DELETE") {
      return handleRevokeAccount(req, res);
    }

    // User routes
    const userMatch = path.match(/^\/api\/users\/([^/]+)$/);
    if (userMatch) {
      return handleGetUser(userMatch[1], res);
    }

    // Calendar routes
    const allEventsMatch = path.match(/^\/api\/calendar\/all-events\/([^/]+)$/);
    if (allEventsMatch && req.method === "GET") {
      return handleGetAllEvents(req, res, allEventsMatch[1]);
    }

    const eventsStreamMatch = path.match(
      /^\/api\/calendar\/events-stream\/([^/]+)$/,
    );
    if (eventsStreamMatch && req.method === "GET") {
      await handleStreamEvents(req, res, eventsStreamMatch[1]);
      return;
    }

    if (path === "/api/calendar/events" && req.method === "POST") {
      return handleCreateEvent(req, res);
    }

    if (path === "/api/calendar/icloud/status") {
      return handleICloudStatus(req, res);
    }

    const icloudDeleteMatch = path.match(/^\/api\/calendar\/icloud\/([^/]+)$/);
    if (icloudDeleteMatch && req.method === "DELETE") {
      return handleRemoveICloud(req, res, icloudDeleteMatch[1]);
    }

    if (path === "/api/calendar/outlook/status") {
      return handleOutlookStatus(req, res);
    }

    const outlookDeleteMatch = path.match(
      /^\/api\/calendar\/outlook\/([^/]+)$/,
    );
    if (outlookDeleteMatch && req.method === "DELETE") {
      return handleRemoveOutlook(req, res, outlookDeleteMatch[1]);
    }

    // Friends routes
    if (path === "/api/friends" && req.method === "GET") {
      return handleGetFriends(req, res);
    }

    if (path === "/api/friends" && req.method === "POST") {
      return handleAddFriend(req, res);
    }

    if (path === "/api/friends/requests/incoming") {
      return handleGetIncomingRequests(req, res);
    }

    if (path === "/api/friends/sync-pending" && req.method === "POST") {
      return handleSyncPending(req, res);
    }

    const acceptMatch = path.match(/^\/api\/friends\/(\d+)\/accept$/);
    if (acceptMatch && req.method === "POST") {
      const friendId = parseInt(acceptMatch[1], 10);
      return handleAcceptFriend(req, res, friendId);
    }

    const rejectMatch = path.match(/^\/api\/friends\/(\d+)\/reject$/);
    if (rejectMatch && req.method === "POST") {
      const friendId = parseInt(rejectMatch[1], 10);
      return handleRejectFriend(req, res, friendId);
    }

    const friendEventsMatch = path.match(/^\/api\/friends\/(\d+)\/events$/);
    if (friendEventsMatch && req.method === "GET") {
      const friendId = parseInt(friendEventsMatch[1], 10);
      return handleGetFriendEvents(req, res, friendId);
    }

    const friendDeleteMatch = path.match(/^\/api\/friends\/(\d+)$/);
    if (friendDeleteMatch && req.method === "DELETE") {
      const friendId = parseInt(friendDeleteMatch[1], 10);
      return handleRemoveFriend(req, res, friendId);
    }

    // AI routes
    if (path === "/api/ai/draft-invitation" && req.method === "POST") {
      return handleDraftInvitation(req, res);
    }

    // Utility routes
    if (path === "/api/privacy" && req.method === "GET") {
      return res.redirect(
        301,
        "https://www.privacypolicies.com/live/206e7238-acb3-4701-ab5c-c102a087fd1a",
      );
    }

    // Root endpoint
    if (path === "/api") {
      return res.status(200).json({
        message: "Shared Calendar API",
        version: "1.0.0",
        environment: "vercel",
        endpoints: [
          "GET /api/health",
          "GET /api/auth/google",
          "GET /api/auth/google/callback",
          "GET /api/auth/me",
          "GET /api/auth/outlook",
          "GET /api/auth/outlook/callback",
          "POST /api/auth/exchange",
          "POST /api/auth/icloud",
          "DELETE /api/auth/revoke",
          "GET /api/users/:id",
          "GET /api/calendar/all-events/:userId",
          "GET /api/calendar/events-stream/:userId (SSE)",
          "POST /api/calendar/events",
          "GET /api/calendar/icloud/status",
          "DELETE /api/calendar/icloud/:userId",
          "GET /api/calendar/outlook/status",
          "DELETE /api/calendar/outlook/:userId",
          "GET /api/friends",
          "POST /api/friends",
          "DELETE /api/friends/:friendId",
          "GET /api/friends/requests/incoming",
          "POST /api/friends/sync-pending",
          "POST /api/friends/:friendId/accept",
          "POST /api/friends/:friendId/reject",
          "GET /api/friends/:friendId/events",
          "POST /api/ai/draft-invitation",
          "GET /api/privacy",
        ],
      });
    }

    // 404
    return res.status(404).json({ error: "Not found", path, rawUrl: req.url });
  } catch (error) {
    console.error("API Error:", error);
    return res.status(500).json({
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
