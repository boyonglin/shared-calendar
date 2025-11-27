/**
 * Vercel Serverless Function Entry Point
 *
 * Complete API with Google OAuth, Calendar operations, and Turso database.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient, type Client } from "@libsql/client";
import { google } from "googleapis";
import jwt from "jsonwebtoken";

// =============================================================================
// Environment Variables
// =============================================================================
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;
const JWT_SECRET = process.env.JWT_SECRET || "default-secret-change-me";
const CLIENT_URL =
  process.env.CLIENT_URL || "https://shared-calendar-vibe.vercel.app";

// =============================================================================
// Database
// =============================================================================
let dbInitialized = false;
let tursoClient: Client | null = null;

function getTursoClient(): Client {
  if (!process.env.TURSO_DATABASE_URL) {
    throw new Error("TURSO_DATABASE_URL is not set");
  }
  if (!tursoClient) {
    tursoClient = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return tursoClient;
}

async function ensureDbInitialized(): Promise<void> {
  if (dbInitialized) return;

  const client = getTursoClient();

  await client.execute(`
    CREATE TABLE IF NOT EXISTS calendar_accounts (
      user_id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      external_email TEXT,
      access_token TEXT,
      refresh_token TEXT,
      encrypted_password TEXT,
      metadata TEXT,
      primary_user_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS user_connections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      friend_email TEXT NOT NULL,
      friend_user_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, friend_email)
    )
  `);

  const indexes = [
    "CREATE INDEX IF NOT EXISTS idx_calendar_accounts_external_email ON calendar_accounts(external_email)",
    "CREATE INDEX IF NOT EXISTS idx_calendar_accounts_primary_user_id ON calendar_accounts(primary_user_id)",
    "CREATE INDEX IF NOT EXISTS idx_user_connections_user_id_status ON user_connections(user_id, status)",
    "CREATE INDEX IF NOT EXISTS idx_user_connections_friend_email ON user_connections(friend_email)",
  ];

  for (const sql of indexes) {
    try {
      await client.execute(sql);
    } catch {
      // Index might already exist
    }
  }

  dbInitialized = true;
}

// =============================================================================
// Google OAuth
// =============================================================================
function getOAuth2Client() {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error("Google OAuth not configured");
  }
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
  );
}

// =============================================================================
// Auth Code Store (in-memory, short-lived)
// =============================================================================
const authCodes = new Map<
  string,
  { userId: string; email: string; provider: string; expires: number }
>();

function createAuthCode(data: {
  userId: string;
  email: string;
  provider: string;
}): string {
  const code =
    Math.random().toString(36).substring(2) + Date.now().toString(36);
  authCodes.set(code, { ...data, expires: Date.now() + 60000 });
  return code;
}

function exchangeAuthCode(code: string) {
  const data = authCodes.get(code);
  if (!data || data.expires < Date.now()) {
    authCodes.delete(code);
    return null;
  }
  authCodes.delete(code);
  return data;
}

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
  const oauth2Client = getOAuth2Client();
  const scopes = [
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/calendar.events",
  ];
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent",
  });
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
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    if (!userInfo.id || !userInfo.email) {
      return res.redirect(`${CLIENT_URL}?auth=error&message=no_user_info`);
    }

    const client = getTursoClient();
    const metadata = JSON.stringify({
      name: userInfo.name,
      picture: userInfo.picture,
    });

    await client.execute({
      sql: `INSERT INTO calendar_accounts (
        user_id, provider, external_email, access_token, refresh_token, metadata, updated_at
      ) VALUES (?, 'google', ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        access_token = excluded.access_token,
        refresh_token = COALESCE(excluded.refresh_token, calendar_accounts.refresh_token),
        metadata = excluded.metadata,
        updated_at = CURRENT_TIMESTAMP`,
      args: [
        userInfo.id,
        userInfo.email,
        tokens.access_token || null,
        tokens.refresh_token || null,
        metadata,
      ],
    });

    const token = jwt.sign(
      { userId: userInfo.id, email: userInfo.email },
      JWT_SECRET,
      { expiresIn: "30d" },
    );

    res.setHeader(
      "Set-Cookie",
      `token=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${30 * 24 * 60 * 60}`,
    );

    const authCode = createAuthCode({
      userId: userInfo.id,
      email: userInfo.email,
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

async function handleGetUser(
  userId: string,
  res: VercelResponse,
): Promise<VercelResponse> {
  const client = getTursoClient();
  const result = await client.execute({
    sql: "SELECT * FROM calendar_accounts WHERE user_id = ?",
    args: [userId],
  });

  if (result.rows.length === 0) {
    return res.status(404).json({ error: "User not found" });
  }

  const account = result.rows[0];
  const metadata = JSON.parse((account.metadata as string) || "{}");

  return res.status(200).json({
    profile: {
      email: account.external_email,
      name: metadata.name,
      picture: metadata.picture,
      sub: account.user_id,
    },
    provider: account.provider,
  });
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

  const client = getTursoClient();

  // Get all accounts for this user (primary + linked)
  const result = await client.execute({
    sql: "SELECT * FROM calendar_accounts WHERE user_id = ? OR primary_user_id = ?",
    args: [userId, userId],
  });

  if (result.rows.length === 0) {
    return res.status(200).json([]);
  }

  const allEvents: Array<Record<string, unknown>> = [];
  const queryString = req.url?.split("?")[1] || "";
  const params = new URLSearchParams(queryString);
  const timeMin = params.get("timeMin")
    ? new Date(params.get("timeMin")!)
    : new Date();
  const timeMax = params.get("timeMax")
    ? new Date(params.get("timeMax")!)
    : new Date(Date.now() + 28 * 24 * 60 * 60 * 1000);

  for (const account of result.rows) {
    if (account.provider === "google" && account.access_token) {
      try {
        const oauth2Client = getOAuth2Client();
        oauth2Client.setCredentials({
          access_token: account.access_token as string,
          refresh_token: (account.refresh_token as string) || undefined,
        });

        // Handle token refresh
        oauth2Client.on("tokens", async (tokens) => {
          if (tokens.access_token) {
            await client.execute({
              sql: "UPDATE calendar_accounts SET access_token = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
              args: [tokens.access_token, account.user_id],
            });
          }
        });

        const calendar = google.calendar({ version: "v3", auth: oauth2Client });
        const response = await calendar.events.list({
          calendarId: "primary",
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
          singleEvents: true,
          orderBy: "startTime",
        });

        const events = (response.data.items || []).map((event) => ({
          ...event,
          calendarId: "primary",
          accountType: "google",
          accountEmail: account.external_email,
          userId: account.user_id,
        }));
        allEvents.push(...events);
      } catch (err) {
        console.error(
          `Error fetching Google events for ${account.user_id}:`,
          err,
        );
      }
    }
    // TODO: Add iCloud and Outlook support here
  }

  return res.status(200).json(allEvents);
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

  const client = getTursoClient();
  const result = await client.execute({
    sql: "SELECT * FROM calendar_accounts WHERE user_id = ?",
    args: [user.userId],
  });

  if (result.rows.length === 0) {
    return res.status(404).json({ error: "User not found" });
  }

  const account = result.rows[0];

  if (account.provider !== "google") {
    return res.status(400).json({ error: "Only Google calendar supported" });
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: account.access_token as string,
    refresh_token: (account.refresh_token as string) || undefined,
  });

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  const eventData = {
    summary: title,
    description,
    start: isAllDay ? { date: start } : { dateTime: start },
    end: isAllDay ? { date: end } : { dateTime: end },
    attendees: attendees?.map((email: string) => ({ email })),
  };

  const response = await calendar.events.insert({
    calendarId: "primary",
    requestBody: eventData,
    sendUpdates: "all",
  });

  return res.status(200).json(response.data);
}

async function handleICloudStatus(
  req: VercelRequest,
  res: VercelResponse,
): Promise<VercelResponse> {
  const user = verifyToken(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const client = getTursoClient();
  const result = await client.execute({
    sql: "SELECT * FROM calendar_accounts WHERE provider = 'icloud' AND primary_user_id = ?",
    args: [user.userId],
  });

  if (result.rows.length === 0) {
    return res.status(200).json({ connected: false });
  }

  const account = result.rows[0];
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

  const client = getTursoClient();
  await client.execute({
    sql: "DELETE FROM calendar_accounts WHERE provider = 'icloud' AND (user_id = ? OR primary_user_id = ?)",
    args: [userId, user.userId],
  });

  return res.status(200).json({ success: true });
}

async function handleOutlookStatus(
  req: VercelRequest,
  res: VercelResponse,
): Promise<VercelResponse> {
  const user = verifyToken(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const client = getTursoClient();
  const result = await client.execute({
    sql: "SELECT * FROM calendar_accounts WHERE provider = 'outlook' AND primary_user_id = ?",
    args: [user.userId],
  });

  if (result.rows.length === 0) {
    return res.status(200).json({ connected: false });
  }

  const account = result.rows[0];
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

  const client = getTursoClient();
  await client.execute({
    sql: "DELETE FROM calendar_accounts WHERE provider = 'outlook' AND (user_id = ? OR primary_user_id = ?)",
    args: [userId, user.userId],
  });

  return res.status(200).json({ success: true });
}

// =============================================================================
// Main Handler
// =============================================================================
export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<VercelResponse | void> {
  const path = req.url?.split("?")[0] || "/api";

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
    if (path === "/api/health" || path === "/api/health/") {
      const client = getTursoClient();
      await client.execute("SELECT 1");
      return res.status(200).json({
        status: "ok",
        timestamp: new Date().toISOString(),
        environment: "vercel",
      });
    }

    // ===================
    // Auth routes
    // ===================
    if (path === "/api/auth/google" || path === "/api/auth/google/") {
      return handleGoogleAuth(res);
    }
    if (
      path === "/api/auth/google/callback" ||
      path === "/api/auth/google/callback/"
    ) {
      return handleGoogleCallback(req, res);
    }
    if (path === "/api/auth/exchange" || path === "/api/auth/exchange/") {
      return handleAuthExchange(req, res);
    }

    // ===================
    // User routes - /api/users/:id
    // ===================
    const userMatch = path.match(/^\/api\/users\/([^/]+)\/?$/);
    if (userMatch) {
      return handleGetUser(userMatch[1], res);
    }

    // ===================
    // Calendar routes
    // ===================

    // GET /api/calendar/all-events/:userId
    const allEventsMatch = path.match(
      /^\/api\/calendar\/all-events\/([^/]+)\/?$/,
    );
    if (allEventsMatch && req.method === "GET") {
      return handleGetAllEvents(req, res, allEventsMatch[1]);
    }

    // POST /api/calendar/events
    if (
      (path === "/api/calendar/events" || path === "/api/calendar/events/") &&
      req.method === "POST"
    ) {
      return handleCreateEvent(req, res);
    }

    // GET /api/calendar/icloud/status
    if (
      path === "/api/calendar/icloud/status" ||
      path === "/api/calendar/icloud/status/"
    ) {
      return handleICloudStatus(req, res);
    }

    // DELETE /api/calendar/icloud/:userId
    const icloudDeleteMatch = path.match(
      /^\/api\/calendar\/icloud\/([^/]+)\/?$/,
    );
    if (icloudDeleteMatch && req.method === "DELETE") {
      return handleRemoveICloud(req, res, icloudDeleteMatch[1]);
    }

    // GET /api/calendar/outlook/status
    if (
      path === "/api/calendar/outlook/status" ||
      path === "/api/calendar/outlook/status/"
    ) {
      return handleOutlookStatus(req, res);
    }

    // DELETE /api/calendar/outlook/:userId
    const outlookDeleteMatch = path.match(
      /^\/api\/calendar\/outlook\/([^/]+)\/?$/,
    );
    if (outlookDeleteMatch && req.method === "DELETE") {
      return handleRemoveOutlook(req, res, outlookDeleteMatch[1]);
    }

    // Root endpoint
    if (path === "/api" || path === "/api/") {
      return res.status(200).json({
        message: "Shared Calendar API",
        version: "1.0.0",
        environment: "vercel",
        endpoints: [
          "GET /api/health",
          "GET /api/auth/google",
          "GET /api/auth/google/callback",
          "POST /api/auth/exchange",
          "GET /api/users/:id",
          "GET /api/calendar/all-events/:userId",
          "POST /api/calendar/events",
          "GET /api/calendar/icloud/status",
          "DELETE /api/calendar/icloud/:userId",
          "GET /api/calendar/outlook/status",
          "DELETE /api/calendar/outlook/:userId",
        ],
      });
    }

    // 404
    return res.status(404).json({ error: "Not found", path });
  } catch (error) {
    console.error("API Error:", error);
    return res.status(500).json({
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
