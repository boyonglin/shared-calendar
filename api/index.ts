/**
 * Vercel Serverless Function Entry Point
 *
 * Full API with Google OAuth and Turso database.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@libsql/client";
import { google } from "googleapis";
import jwt from "jsonwebtoken";

// Environment variables
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;
const JWT_SECRET = process.env.JWT_SECRET || "default-secret-change-me";
const CLIENT_URL =
  process.env.CLIENT_URL || "https://shared-calendar-vibe.vercel.app";

// Database initialization flag
let dbInitialized = false;

// Initialize Turso client
function getTursoClient() {
  if (!process.env.TURSO_DATABASE_URL) {
    throw new Error("TURSO_DATABASE_URL is not set");
  }
  return createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
}

// Initialize database schema if not already done
async function ensureDbInitialized() {
  if (dbInitialized) return;

  const client = getTursoClient();

  // Create tables
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

  // Create indexes (ignore errors if they already exist)
  const indexes = [
    "CREATE INDEX IF NOT EXISTS idx_calendar_accounts_external_email ON calendar_accounts(external_email)",
    "CREATE INDEX IF NOT EXISTS idx_calendar_accounts_primary_user_id ON calendar_accounts(primary_user_id)",
    "CREATE INDEX IF NOT EXISTS idx_user_connections_user_id_status ON user_connections(user_id, status)",
    "CREATE INDEX IF NOT EXISTS idx_user_connections_friend_email ON user_connections(friend_email)",
    "CREATE INDEX IF NOT EXISTS idx_user_connections_friend_user_id ON user_connections(friend_user_id)",
  ];

  for (const sql of indexes) {
    try {
      await client.execute(sql);
    } catch {
      // Index might already exist
    }
  }

  dbInitialized = true;
  console.log("✅ Database schema initialized");
}

// Google OAuth client
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

// Simple auth code store (in-memory, expires quickly)
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
  authCodes.set(code, { ...data, expires: Date.now() + 60000 }); // 1 minute expiry
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const path = req.url?.split("?")[0] || "/api";

  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", CLIENT_URL);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // Ensure database schema is initialized
    await ensureDbInitialized();

    // Health check
    if (path === "/api/health" || path === "/api/health/") {
      const client = getTursoClient();
      await client.execute("SELECT 1");
      return res.status(200).json({
        status: "ok",
        timestamp: new Date().toISOString(),
        environment: "vercel",
        node_version: process.version,
        checks: { database: "ok" },
      });
    }

    // Google OAuth - Start
    if (path === "/api/auth/google" || path === "/api/auth/google/") {
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

    // Google OAuth - Callback
    if (
      path === "/api/auth/google/callback" ||
      path === "/api/auth/google/callback/"
    ) {
      try {
        const code = req.query.code as string;
        const error = req.query.error as string;

        // Handle OAuth errors (user denied, etc.)
        if (error) {
          console.error("OAuth error:", error);
          return res.redirect(
            `${CLIENT_URL}?auth=error&message=${encodeURIComponent(error)}`,
          );
        }

        if (!code) {
          return res.redirect(`${CLIENT_URL}?auth=error&message=missing_code`);
        }

        const oauth2Client = getOAuth2Client();
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // Get user info
        const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
        const { data: userInfo } = await oauth2.userinfo.get();

        if (!userInfo.id || !userInfo.email) {
          return res.redirect(`${CLIENT_URL}?auth=error&message=no_user_info`);
        }

        // Store in Turso
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
            updated_at = CURRENT_TIMESTAMP`,
          args: [
            userInfo.id,
            userInfo.email,
            tokens.access_token || null,
            tokens.refresh_token || null,
            metadata,
          ],
        });

        // Generate JWT
        const token = jwt.sign(
          { userId: userInfo.id, email: userInfo.email },
          JWT_SECRET,
          { expiresIn: "30d" },
        );

        // Set cookie
        res.setHeader(
          "Set-Cookie",
          `token=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${30 * 24 * 60 * 60}`,
        );

        // Create auth code for client
        const authCode = createAuthCode({
          userId: userInfo.id,
          email: userInfo.email,
          provider: "google",
        });

        return res.redirect(`${CLIENT_URL}?auth=success&code=${authCode}`);
      } catch (callbackError) {
        console.error("Google callback error:", callbackError);
        const message =
          callbackError instanceof Error
            ? callbackError.message
            : "unknown_error";
        return res.redirect(
          `${CLIENT_URL}?auth=error&message=${encodeURIComponent(message)}`,
        );
      }
    }

    // Exchange auth code for user data
    if (path === "/api/auth/exchange" || path === "/api/auth/exchange/") {
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

    // Get user profile - matches both /api/users/:id/google and /api/users/:id
    if (path.startsWith("/api/users/") && !path.includes("/calendar")) {
      const pathParts = path.split("/").filter(Boolean);
      // pathParts = ["api", "users", "userId"] or ["api", "users", "userId", "google"]
      const userId = pathParts[2];
      if (!userId) {
        return res.status(400).json({ error: "Missing user ID" });
      }

      const client = getTursoClient();
      const result = await client.execute({
        sql: "SELECT * FROM calendar_accounts WHERE user_id = ? AND provider = 'google'",
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
        provider: "google",
      });
    }

    // Get calendar events
    if (path.startsWith("/api/calendar/events")) {
      // Parse query string manually
      const queryString = req.url?.split("?")[1] || "";
      const params = new URLSearchParams(queryString);
      const userId = params.get("userId") || (req.query?.userId as string);

      if (!userId) {
        return res.status(400).json({ error: "Missing userId parameter" });
      }

      const client = getTursoClient();
      const result = await client.execute({
        sql: "SELECT * FROM calendar_accounts WHERE user_id = ?",
        args: [userId],
      });

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      const account = result.rows[0];
      const accessToken = account.access_token as string;
      const refreshToken = account.refresh_token as string | null;

      if (!accessToken) {
        return res.status(401).json({ error: "No access token" });
      }

      // Create OAuth client with user's tokens
      const oauth2Client = getOAuth2Client();
      oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken || undefined,
      });

      // Handle token refresh
      oauth2Client.on("tokens", async (tokens) => {
        if (tokens.access_token) {
          await client.execute({
            sql: "UPDATE calendar_accounts SET access_token = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
            args: [tokens.access_token, userId],
          });
        }
      });

      try {
        const calendar = google.calendar({ version: "v3", auth: oauth2Client });

        // Default to now + 4 weeks
        const now = new Date();
        const timeMax = new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000);

        const response = await calendar.events.list({
          calendarId: "primary",
          timeMin: now.toISOString(),
          timeMax: timeMax.toISOString(),
          singleEvents: true,
          orderBy: "startTime",
        });

        return res.status(200).json(response.data.items || []);
      } catch (calendarError) {
        console.error("Calendar API error:", calendarError);
        return res.status(500).json({
          error: "Failed to fetch calendar events",
          details:
            calendarError instanceof Error
              ? calendarError.message
              : "Unknown error",
        });
      }
    }

    // Root API endpoint
    if (path === "/api" || path === "/api/") {
      return res.status(200).json({
        message: "Shared Calendar API",
        version: "1.0.0",
        status: "running",
        environment: "vercel",
        endpoints: [
          "/api/health",
          "/api/auth/google",
          "/api/auth/google/callback",
          "/api/auth/exchange",
          "/api/users/:id/google",
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
      timestamp: new Date().toISOString(),
    });
  }
}
