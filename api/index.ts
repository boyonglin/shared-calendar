/**
 * Vercel Serverless Function Entry Point
 *
 * Complete API with Google OAuth, Calendar operations, and Turso database.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient, type Client } from "@libsql/client";
import { google } from "googleapis";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { DAVClient } from "tsdav";
import { GoogleGenerativeAI } from "@google/generative-ai";
import ical from "node-ical";

// =============================================================================
// Environment Variables
// =============================================================================
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;
const JWT_SECRET = process.env.JWT_SECRET || "default-secret-change-me";
const CLIENT_URL =
  process.env.CLIENT_URL || "https://shared-calendar-vibe.vercel.app";

// OneCal Configuration (for Outlook Calendar integration)
const ONECAL_APP_ID = process.env.ONECAL_APP_ID;
const ONECAL_API_KEY = process.env.ONECAL_API_KEY;
const ONECAL_API_BASE = "https://api.onecalunified.com/api/v1";

// Encryption Configuration (for iCloud password storage)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const IV_LENGTH = 16;

// AI Configuration
const AI_MAX_INPUT_LENGTH = 1000;
const AI_MAX_ATTENDEE_LENGTH = 100;
const AI_MAX_ATTENDEES = 50;

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
// Encryption Helpers (for iCloud password storage)
// =============================================================================

function getEncryptionKey(): Buffer {
  if (!ENCRYPTION_KEY) {
    throw new Error(
      "ENCRYPTION_KEY is required for iCloud integration. Please set it in your environment.",
    );
  }

  // If the key is a hex string (64 characters), decode it
  if (ENCRYPTION_KEY.length === 64 && /^[0-9a-fA-F]+$/.test(ENCRYPTION_KEY)) {
    return Buffer.from(ENCRYPTION_KEY, "hex");
  }

  // Otherwise treat as raw string and validate length
  const key = Buffer.from(ENCRYPTION_KEY);
  if (key.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY must be exactly 32 bytes (or 64 hex characters), got ${key.length} bytes`,
    );
  }
  return key;
}

function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", getEncryptionKey(), iv);
  let encrypted = cipher.update(text, "utf8");
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

function decrypt(text: string): string {
  const textParts = text.split(":");
  const iv = Buffer.from(textParts.shift()!, "hex");
  const encryptedText = Buffer.from(textParts.join(":"), "hex");
  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    getEncryptionKey(),
    iv,
  );
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

// =============================================================================
// AI Helpers
// =============================================================================

// Patterns that could be used for prompt injection attacks
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions?/gi,
  /ignore\s+(all\s+)?prior\s+instructions?/gi,
  /disregard\s+(all\s+)?previous/gi,
  /forget\s+(all\s+)?previous/gi,
  /you\s+are\s+now/gi,
  /new\s+instructions?:/gi,
  /system\s*:/gi,
  /\[system\]/gi,
  /\[assistant\]/gi,
  /\[user\]/gi,
];

function sanitizeInput(input: string, maxLength = AI_MAX_INPUT_LENGTH): string {
  let sanitized = input.replace(/[`${}]/g, "").trim();

  for (const pattern of INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, "");
  }

  return sanitized.slice(0, maxLength);
}

function sanitizeOutput(text: string): string {
  return text
    .replace(/```(?:markdown|html)?\n?([\s\S]*?)\n?```/gi, "$1")
    .replace(/<\/?[^>]+(>|$)/g, "")
    .trim();
}

type Tone = "professional" | "casual" | "friendly";
const VALID_TONES: Tone[] = ["professional", "casual", "friendly"];

function buildAIPrompt(params: {
  title: string;
  description: string;
  location: string;
  attendees: string[];
  start: string;
  end: string;
  tone: Tone;
}): string {
  const { title, description, location, attendees, start, end, tone } = params;
  const lines = [
    "You are an AI assistant helping to draft a calendar invitation.",
    "",
    "Event Details:",
    `Title: ${title}`,
    `Time: ${start} to ${end}`,
  ];

  if (description) lines.push(`Description: ${description}`);
  if (location) lines.push(`Location: ${location}`);
  if (attendees.length) lines.push(`Attendees: ${attendees.join(", ")}`);

  lines.push(
    "",
    `Please write a ${tone} invitation message for this event.`,
    "The message should be ready to send via email or chat.",
    "Keep it concise but clear.",
    "",
    "Output only plain text. Do not include any HTML tags, markdown formatting, or code blocks.",
  );

  return lines.join("\n");
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
    "https://www.googleapis.com/auth/calendar.events.readonly",
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

    // Process any pending friend requests that were sent to this user before they registered
    const normalizedEmail = userInfo.email.toLowerCase();
    const userId = userInfo.id;

    // Find pending friend requests sent to this email
    const pendingRequestsResult = await client.execute({
      sql: `SELECT uc.*, ca.external_email as requester_email
            FROM user_connections uc
            LEFT JOIN calendar_accounts ca ON ca.user_id = uc.user_id
            WHERE LOWER(uc.friend_email) = LOWER(?) AND uc.status IN ('pending', 'requested')`,
      args: [normalizedEmail],
    });

    // Process each pending request
    for (const request of pendingRequestsResult.rows) {
      const requestId = request.id as number;
      const requestUserId = request.user_id as string;
      const requesterEmail = request.requester_email as string | null;

      // Update the requester's connection to 'requested' status with the new user's ID
      await client.execute({
        sql: `UPDATE user_connections 
              SET friend_user_id = ?, status = 'requested', updated_at = CURRENT_TIMESTAMP
              WHERE id = ?`,
        args: [userId, requestId],
      });

      // Create incoming request for the new user if the requester has an email
      if (requesterEmail) {
        const requesterEmailLower = requesterEmail.toLowerCase();

        // Check if an incoming connection already exists
        const existingResult = await client.execute({
          sql: `SELECT id FROM user_connections 
                WHERE user_id = ? AND LOWER(friend_email) = LOWER(?)`,
          args: [userId, requesterEmailLower],
        });

        if (existingResult.rows.length === 0) {
          // Create the incoming request for the new user
          await client.execute({
            sql: `INSERT OR IGNORE INTO user_connections (user_id, friend_email, friend_user_id, status)
                  VALUES (?, ?, ?, 'incoming')`,
            args: [userId, requesterEmailLower, requestUserId],
          });
        }
      }
    }

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

    // Fetch Outlook events via OneCal
    if (
      account.provider === "outlook" &&
      account.access_token &&
      ONECAL_API_KEY
    ) {
      try {
        const endUserAccountId = account.access_token as string;

        // First, get calendars for this account
        const calendarsResponse = await fetch(
          `${ONECAL_API_BASE}/calendars/${endUserAccountId}`,
          {
            headers: { "x-api-key": ONECAL_API_KEY },
          },
        );

        if (!calendarsResponse.ok) {
          console.error(
            `Failed to fetch Outlook calendars: ${await calendarsResponse.text()}`,
          );
          continue;
        }

        const calendarsData = (await calendarsResponse.json()) as {
          data?: Array<{ id: string; name: string; isPrimary?: boolean }>;
        };
        const allCalendars = calendarsData.data || [];

        // Use primary calendar or first available
        const primaryCalendar = allCalendars.find((cal) => cal.isPrimary);
        const calendars = primaryCalendar
          ? [primaryCalendar]
          : allCalendars.slice(0, 1);

        for (const calendar of calendars) {
          const eventsParams = new URLSearchParams({
            startDateTime: timeMin.toISOString(),
            endDateTime: timeMax.toISOString(),
            expandRecurrences: "true",
          });

          const eventsResponse = await fetch(
            `${ONECAL_API_BASE}/events/${endUserAccountId}/${calendar.id}?${eventsParams}`,
            { headers: { "x-api-key": ONECAL_API_KEY } },
          );

          if (!eventsResponse.ok) {
            console.error(
              `Failed to fetch Outlook events: ${await eventsResponse.text()}`,
            );
            continue;
          }

          const eventsData = (await eventsResponse.json()) as {
            data?: Array<{
              id: string;
              title?: string;
              summary?: string;
              start?: { dateTime?: string; date?: string };
              end?: { dateTime?: string; date?: string };
            }>;
          };
          const onecalEvents = eventsData.data || [];

          for (const event of onecalEvents) {
            allEvents.push({
              id: event.id,
              summary: event.title || event.summary || "Untitled Event",
              start: {
                dateTime: event.start?.dateTime,
                date: event.start?.date,
              },
              end: {
                dateTime: event.end?.dateTime,
                date: event.end?.date,
              },
              calendarId: calendar.id,
              accountType: "outlook",
              accountEmail: account.external_email,
              userId: account.user_id,
            });
          }
        }
      } catch (err) {
        console.error(
          `Error fetching Outlook events for ${account.user_id}:`,
          err,
        );
      }
    }

    // Fetch iCloud events via CalDAV
    if (account.provider === "icloud" && account.encrypted_password) {
      try {
        // Decrypt the stored password
        const password = decrypt(account.encrypted_password as string);

        // Create CalDAV client
        const davClient = new DAVClient({
          serverUrl: "https://caldav.icloud.com",
          credentials: {
            username: account.external_email as string,
            password: password,
          },
          authMethod: "Basic",
          defaultAccountType: "caldav",
        });

        await davClient.login();
        const calendars = await davClient.fetchCalendars();

        for (const calendar of calendars) {
          const objects = await davClient.fetchCalendarObjects({ calendar });

          for (const obj of objects) {
            if (obj.data) {
              try {
                const parsed = ical.parseICS(obj.data);

                for (const key in parsed) {
                  const event = parsed[key];
                  if (event.type === "VEVENT") {
                    const startDate = event.start;
                    const endDate = event.end;

                    // Filter to only events within the time range
                    if (
                      startDate &&
                      startDate >= timeMin &&
                      startDate <= timeMax
                    ) {
                      allEvents.push({
                        id: event.uid || key,
                        summary: event.summary || "Untitled Event",
                        start: { dateTime: startDate.toISOString() },
                        end: {
                          dateTime: endDate
                            ? endDate.toISOString()
                            : startDate.toISOString(),
                        },
                        calendarId: calendar.url,
                        accountType: "icloud",
                        accountEmail: account.external_email,
                        userId: account.user_id,
                      });
                    }
                  }
                }
              } catch (parseErr) {
                // Skip malformed calendar objects
                console.error(
                  `Error parsing iCloud calendar object for ${account.user_id}:`,
                  parseErr,
                );
              }
            }
          }
        }
      } catch (err) {
        console.error(
          `Error fetching iCloud events for ${account.user_id}:`,
          err,
        );
      }
    }
  }

  return res.status(200).json(allEvents);
}

/**
 * Stream events from all calendar providers as Server-Sent Events (SSE)
 * Events are sent progressively as each provider completes fetching
 */
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

  const client = getTursoClient();

  // Parse query parameters
  const queryString = req.url?.split("?")[1] || "";
  const params = new URLSearchParams(queryString);
  const timeMin = params.get("timeMin")
    ? new Date(params.get("timeMin")!)
    : new Date();
  const timeMax = params.get("timeMax")
    ? new Date(params.get("timeMax")!)
    : new Date(Date.now() + 28 * 24 * 60 * 60 * 1000);

  // Get all accounts for this user (primary + linked)
  const result = await client.execute({
    sql: "SELECT * FROM calendar_accounts WHERE user_id = ? OR primary_user_id = ?",
    args: [userId, userId],
  });

  // Set up SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  if (result.rows.length === 0) {
    res.write(`data: ${JSON.stringify({ type: "complete", events: [] })}\n\n`);
    res.end();
    return;
  }

  // Helper to send SSE message
  const sendEvent = (data: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Fetch events from all providers in parallel
  const fetchPromises = result.rows.map(async (account) => {
    const provider = account.provider as string;
    const events: Array<Record<string, unknown>> = [];

    try {
      if (provider === "google" && account.access_token) {
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

        const googleEvents = (response.data.items || []).map((event) => ({
          ...event,
          calendarId: "primary",
          accountType: "google",
          accountEmail: account.external_email,
          userId: account.user_id,
        }));
        events.push(...googleEvents);
      }

      if (provider === "outlook" && account.access_token && ONECAL_API_KEY) {
        const endUserAccountId = account.access_token as string;

        const calendarsResponse = await fetch(
          `${ONECAL_API_BASE}/calendars/${endUserAccountId}`,
          { headers: { "x-api-key": ONECAL_API_KEY } },
        );

        if (calendarsResponse.ok) {
          const calendarsData = (await calendarsResponse.json()) as {
            data?: Array<{ id: string; name: string; isPrimary?: boolean }>;
          };
          const allCalendars = calendarsData.data || [];
          const primaryCalendar = allCalendars.find((cal) => cal.isPrimary);
          const calendars = primaryCalendar
            ? [primaryCalendar]
            : allCalendars.slice(0, 1);

          for (const cal of calendars) {
            const eventsParams = new URLSearchParams({
              startDateTime: timeMin.toISOString(),
              endDateTime: timeMax.toISOString(),
              expandRecurrences: "true",
            });

            const eventsResponse = await fetch(
              `${ONECAL_API_BASE}/events/${endUserAccountId}/${cal.id}?${eventsParams}`,
              { headers: { "x-api-key": ONECAL_API_KEY } },
            );

            if (eventsResponse.ok) {
              const eventsData = (await eventsResponse.json()) as {
                data?: Array<{
                  id: string;
                  title?: string;
                  summary?: string;
                  start?: { dateTime?: string; date?: string };
                  end?: { dateTime?: string; date?: string };
                }>;
              };

              for (const event of eventsData.data || []) {
                events.push({
                  id: event.id,
                  summary: event.title || event.summary || "Untitled Event",
                  start: {
                    dateTime: event.start?.dateTime,
                    date: event.start?.date,
                  },
                  end: {
                    dateTime: event.end?.dateTime,
                    date: event.end?.date,
                  },
                  calendarId: cal.id,
                  accountType: "outlook",
                  accountEmail: account.external_email,
                  userId: account.user_id,
                });
              }
            }
          }
        }
      }

      if (provider === "icloud" && account.encrypted_password) {
        const password = decrypt(account.encrypted_password as string);

        const davClient = new DAVClient({
          serverUrl: "https://caldav.icloud.com",
          credentials: {
            username: account.external_email as string,
            password: password,
          },
          authMethod: "Basic",
          defaultAccountType: "caldav",
        });

        await davClient.login();
        const calendars = await davClient.fetchCalendars();

        for (const calendar of calendars) {
          const objects = await davClient.fetchCalendarObjects({ calendar });

          for (const obj of objects) {
            if (obj.data) {
              try {
                const parsed = ical.parseICS(obj.data);

                for (const key in parsed) {
                  const event = parsed[key];
                  if (event.type === "VEVENT") {
                    const startDate = event.start;
                    const endDate = event.end;

                    if (
                      startDate &&
                      startDate >= timeMin &&
                      startDate <= timeMax
                    ) {
                      events.push({
                        id: event.uid || key,
                        summary: event.summary || "Untitled Event",
                        start: { dateTime: startDate.toISOString() },
                        end: {
                          dateTime: endDate
                            ? endDate.toISOString()
                            : startDate.toISOString(),
                        },
                        calendarId: calendar.url,
                        accountType: "icloud",
                        accountEmail: account.external_email,
                        userId: account.user_id,
                      });
                    }
                  }
                }
              } catch (parseErr) {
                console.error(
                  `Error parsing iCloud calendar object for ${account.user_id}:`,
                  parseErr,
                );
              }
            }
          }
        }
      }

      // Send events for this provider immediately
      if (events.length > 0 || provider) {
        sendEvent({
          type: "events",
          provider: provider,
          events: events,
        });
      }
    } catch (err) {
      console.error(
        `Error fetching ${provider} events for ${account.user_id}:`,
        err,
      );
      sendEvent({
        type: "error",
        provider: provider,
        message: `Failed to fetch ${provider} events`,
      });
    }
  });

  // Wait for all fetches to complete
  await Promise.all(fetchPromises);

  // Send completion signal
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

async function handleICloudConnect(
  req: VercelRequest,
  res: VercelResponse,
): Promise<VercelResponse> {
  const user = verifyToken(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { email, password } = req.body || {};

  // Validate email format and type
  if (
    !email ||
    typeof email !== "string" ||
    !email.includes("@") ||
    email.length > 255
  ) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  // Validate password format and type
  if (
    !password ||
    typeof password !== "string" ||
    password.length < 1 ||
    password.length > 1000
  ) {
    return res.status(400).json({ error: "Invalid password format" });
  }

  // Verify credentials with Apple's CalDAV server using tsdav
  const davClient = new DAVClient({
    serverUrl: "https://caldav.icloud.com",
    credentials: {
      username: email,
      password: password,
    },
    authMethod: "Basic",
    defaultAccountType: "caldav",
  });

  try {
    await davClient.login();
    // Attempt to fetch calendars to verify credentials are valid
    await davClient.fetchCalendars();
  } catch (error) {
    console.error("iCloud verification failed:", error);
    return res.status(401).json({
      error:
        "Failed to verify iCloud credentials. Please check your Apple ID and App-Specific Password.",
    });
  }

  // Generate a new ID for this iCloud connection
  const iCloudUserId = `icloud_${crypto.randomUUID()}`;

  // Encrypt the app-specific password
  const encryptedPassword = encrypt(password);

  // Store the iCloud account in the database
  const client = getTursoClient();
  const metadata = JSON.stringify({ name: email });

  try {
    await client.execute({
      sql: `INSERT INTO calendar_accounts (
        user_id, provider, external_email, encrypted_password, metadata, primary_user_id, updated_at
      ) VALUES (?, 'icloud', ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        external_email = excluded.external_email,
        encrypted_password = excluded.encrypted_password,
        metadata = excluded.metadata,
        updated_at = CURRENT_TIMESTAMP`,
      args: [iCloudUserId, email, encryptedPassword, metadata, user.userId],
    });
  } catch (error) {
    console.error("Failed to store iCloud account:", error);
    return res.status(500).json({
      error: "Failed to save iCloud connection. Please try again.",
    });
  }

  return res.status(200).json({
    success: true,
    user: {
      id: iCloudUserId,
      email: email,
      provider: "icloud",
    },
  });
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
// Outlook OAuth Handlers (via OneCal)
// =============================================================================

interface OnecalEndUserAccount {
  id: string;
  email: string;
  providerType: "MICROSOFT" | "GOOGLE";
  status: string;
  createdAt: string;
  updatedAt: string;
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

  if (!ONECAL_APP_ID) {
    return res.status(500).json({ error: "ONECAL_APP_ID is not configured" });
  }

  // Generate a signed JWT state token that contains the user ID
  const stateToken = jwt.sign({ userId: user.userId }, JWT_SECRET, {
    expiresIn: "10m",
  });

  // Store the signed state token in a secure cookie
  res.setHeader(
    "Set-Cookie",
    `outlook_auth_state=${stateToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,
  );

  // Build the OAuth URL with explicit redirectUrl parameter
  // This ensures OneCal redirects back to the correct environment
  const redirectUrl = `${CLIENT_URL.replace(/\/$/, "")}/api/auth/outlook/callback`;
  const url = `${ONECAL_API_BASE}/oauth/authorize/${ONECAL_APP_ID}/microsoft?redirectUrl=${encodeURIComponent(redirectUrl)}`;
  return res.redirect(url);
}

async function handleOutlookCallback(
  req: VercelRequest,
  res: VercelResponse,
): Promise<VercelResponse> {
  const { endUserAccountId } = req.query;

  // Get state token from cookie
  const cookieHeader = req.headers.cookie || "";
  const stateMatch = cookieHeader.match(/outlook_auth_state=([^;]+)/);
  const stateToken = stateMatch?.[1];

  // Clear the temporary cookie
  res.setHeader(
    "Set-Cookie",
    "outlook_auth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0",
  );

  if (!endUserAccountId || typeof endUserAccountId !== "string") {
    return res.redirect(
      `${CLIENT_URL}?auth=error&message=missing_endUserAccountId`,
    );
  }

  // Validate the signed state token and extract the user ID
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

  if (!ONECAL_API_KEY) {
    return res.redirect(
      `${CLIENT_URL}?auth=error&message=onecal_not_configured`,
    );
  }

  try {
    // Fetch account info from OneCal
    const response = await fetch(
      `${ONECAL_API_BASE}/endUserAccounts/${endUserAccountId}`,
      {
        headers: { "x-api-key": ONECAL_API_KEY },
      },
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("Failed to fetch OneCal account:", error);
      return res.redirect(
        `${CLIENT_URL}?auth=error&message=onecal_fetch_failed`,
      );
    }

    const account = (await response.json()) as OnecalEndUserAccount;

    const metadata = JSON.stringify({
      name: account.email,
      providerType: account.providerType,
      status: account.status,
    });

    // Store the Outlook account in database
    const client = getTursoClient();
    await client.execute({
      sql: `INSERT INTO calendar_accounts (
        user_id, provider, external_email, access_token, metadata, primary_user_id, updated_at
      ) VALUES (?, 'outlook', ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        access_token = excluded.access_token,
        metadata = excluded.metadata,
        updated_at = CURRENT_TIMESTAMP`,
      args: [
        endUserAccountId,
        account.email,
        endUserAccountId, // Store endUserAccountId as access_token for OneCal API calls
        metadata,
        primaryUserId,
      ],
    });

    // Create auth code for client
    const authCode = createAuthCode({
      userId: endUserAccountId,
      email: account.email,
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

// =============================================================================
// Friends Handlers
// =============================================================================

const FRIEND_COLORS = [
  "#EF4444",
  "#F97316",
  "#F59E0B",
  "#EAB308",
  "#84CC16",
  "#22C55E",
  "#10B981",
  "#14B8A6",
  "#06B6D4",
  "#0EA5E9",
  "#3B82F6",
  "#6366F1",
  "#8B5CF6",
  "#A855F7",
  "#D946EF",
  "#EC4899",
  "#F43F5E",
];

function generateFriendColor(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  return FRIEND_COLORS[Math.abs(hash) % FRIEND_COLORS.length];
}

function extractFriendName(metadata: string | null, email: string): string {
  if (metadata) {
    try {
      const parsed = JSON.parse(metadata);
      return parsed.name || email;
    } catch {
      // Use email as fallback
    }
  }
  return email;
}

async function handleGetFriends(
  req: VercelRequest,
  res: VercelResponse,
): Promise<VercelResponse> {
  const user = verifyToken(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const client = getTursoClient();
  const result = await client.execute({
    sql: `SELECT uc.*, ca.metadata 
          FROM user_connections uc
          LEFT JOIN calendar_accounts ca ON ca.external_email = uc.friend_email
          WHERE uc.user_id = ? AND uc.status != 'incoming'
          ORDER BY uc.created_at DESC`,
    args: [user.userId],
  });

  const friends = result.rows.map((conn) => ({
    id: conn.id,
    userId: conn.user_id,
    friendEmail: conn.friend_email,
    friendUserId: conn.friend_user_id,
    friendName: extractFriendName(
      conn.metadata as string | null,
      conn.friend_email as string,
    ),
    friendColor: generateFriendColor(conn.friend_email as string),
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

  const client = getTursoClient();
  const result = await client.execute({
    sql: `SELECT uc.*, ca.metadata 
          FROM user_connections uc
          LEFT JOIN calendar_accounts ca ON ca.external_email = uc.friend_email
          WHERE uc.user_id = ? AND uc.status = 'incoming'
          ORDER BY uc.created_at DESC`,
    args: [user.userId],
  });

  const requests = result.rows.map((conn) => ({
    id: conn.id,
    userId: conn.user_id,
    friendEmail: conn.friend_email,
    friendUserId: conn.friend_user_id,
    friendName: extractFriendName(
      conn.metadata as string | null,
      conn.friend_email as string,
    ),
    friendColor: generateFriendColor(conn.friend_email as string),
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

  const client = getTursoClient();

  // Find pending connections where friend might have signed up
  const pendingResult = await client.execute({
    sql: `SELECT id, friend_email, friend_user_id
          FROM user_connections
          WHERE user_id = ? AND status = 'pending' AND friend_user_id IS NULL`,
    args: [user.userId],
  });

  let updatedCount = 0;

  for (const conn of pendingResult.rows) {
    const friendEmail = conn.friend_email as string;

    // Check if friend has an account now (case-insensitive)
    const friendAccountResult = await client.execute({
      sql: "SELECT user_id FROM calendar_accounts WHERE LOWER(external_email) = LOWER(?)",
      args: [friendEmail],
    });

    if (friendAccountResult.rows.length > 0) {
      const friendUserId = friendAccountResult.rows[0].user_id as string;

      // Update to 'requested' status
      await client.execute({
        sql: "UPDATE user_connections SET friend_user_id = ?, status = 'requested', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        args: [friendUserId, conn.id],
      });

      // Create incoming request for friend
      const currentUserResult = await client.execute({
        sql: "SELECT external_email FROM calendar_accounts WHERE user_id = ?",
        args: [user.userId],
      });

      if (currentUserResult.rows.length > 0) {
        const currentUserEmail = currentUserResult.rows[0]
          .external_email as string;

        // Check if reverse connection exists
        const reverseResult = await client.execute({
          sql: "SELECT id FROM user_connections WHERE user_id = ? AND LOWER(friend_email) = LOWER(?)",
          args: [friendUserId, currentUserEmail.toLowerCase()],
        });

        if (reverseResult.rows.length === 0) {
          await client.execute({
            sql: `INSERT INTO user_connections (user_id, friend_email, friend_user_id, status, created_at, updated_at)
                  VALUES (?, ?, ?, 'incoming', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            args: [friendUserId, currentUserEmail.toLowerCase(), user.userId],
          });
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

function isValidEmail(email: string): boolean {
  // Use the same comprehensive regex as server/src/middleware/validation.ts
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(email);
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

  const client = getTursoClient();

  // Check if user is trying to add themselves
  const userAccountResult = await client.execute({
    sql: "SELECT external_email FROM calendar_accounts WHERE user_id = ? OR primary_user_id = ?",
    args: [user.userId, user.userId],
  });

  const userEmails = userAccountResult.rows
    .map((row) => (row.external_email as string)?.toLowerCase())
    .filter((email): email is string => !!email);

  if (userEmails.includes(normalizedEmail)) {
    return res
      .status(400)
      .json({ error: "You cannot add yourself as a friend" });
  }

  // Check if connection already exists
  const existingResult = await client.execute({
    sql: "SELECT * FROM user_connections WHERE user_id = ? AND LOWER(friend_email) = LOWER(?)",
    args: [user.userId, normalizedEmail],
  });

  if (existingResult.rows.length > 0) {
    const existing = existingResult.rows[0];
    const status = existing.status as string;
    const errorMessages: Record<string, string> = {
      accepted: "You are already friends",
      pending: "Friend request pending",
      requested: "Friend request pending",
      incoming: "You have a pending friend request from this user",
    };
    return res.status(409).json({
      error: errorMessages[status] || "Friend request already sent",
    });
  }

  // Check if friend has an account
  const friendAccountResult = await client.execute({
    sql: "SELECT user_id, metadata FROM calendar_accounts WHERE LOWER(external_email) = ?",
    args: [normalizedEmail],
  });

  const friendAccount =
    friendAccountResult.rows.length > 0 ? friendAccountResult.rows[0] : null;
  const status = friendAccount ? "requested" : "pending";
  const friendUserId = friendAccount ? (friendAccount.user_id as string) : null;

  // Get current user's email for reverse connection
  const primaryUserResult = await client.execute({
    sql: "SELECT external_email FROM calendar_accounts WHERE user_id = ?",
    args: [user.userId],
  });

  const primaryUserEmail =
    primaryUserResult.rows.length > 0
      ? (primaryUserResult.rows[0].external_email as string)
      : null;

  try {
    // Create the friend connection
    await client.execute({
      sql: `INSERT INTO user_connections (user_id, friend_email, friend_user_id, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      args: [user.userId, normalizedEmail, friendUserId, status],
    });

    // Create incoming request for friend if they have an account
    if (friendAccount && primaryUserEmail) {
      const reverseExistingResult = await client.execute({
        sql: "SELECT id FROM user_connections WHERE user_id = ? AND LOWER(friend_email) = LOWER(?)",
        args: [friendUserId, primaryUserEmail.toLowerCase()],
      });

      if (reverseExistingResult.rows.length === 0) {
        await client.execute({
          sql: `INSERT OR IGNORE INTO user_connections (user_id, friend_email, friend_user_id, status, created_at, updated_at)
                VALUES (?, ?, ?, 'incoming', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          args: [friendUserId, primaryUserEmail.toLowerCase(), user.userId],
        });
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

  // Get the inserted connection
  const connectionResult = await client.execute({
    sql: "SELECT * FROM user_connections WHERE user_id = ? AND LOWER(friend_email) = LOWER(?)",
    args: [user.userId, normalizedEmail],
  });

  const connection = connectionResult.rows[0];

  return res.status(201).json({
    success: true,
    connection: {
      id: connection.id,
      userId: connection.user_id,
      friendEmail: connection.friend_email,
      friendUserId: connection.friend_user_id,
      friendName: extractFriendName(
        friendAccount?.metadata as string | null,
        normalizedEmail,
      ),
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

  const client = getTursoClient();

  // Find the connection
  const connectionResult = await client.execute({
    sql: "SELECT * FROM user_connections WHERE id = ? AND user_id = ?",
    args: [friendId, user.userId],
  });

  if (connectionResult.rows.length === 0) {
    return res.status(404).json({ error: "Friend connection not found" });
  }

  const connection = connectionResult.rows[0];

  // Delete the connection
  await client.execute({
    sql: "DELETE FROM user_connections WHERE id = ?",
    args: [friendId],
  });

  // Remove reverse connection
  if (connection.friend_user_id) {
    const userAccountResult = await client.execute({
      sql: "SELECT external_email FROM calendar_accounts WHERE user_id = ?",
      args: [user.userId],
    });

    if (userAccountResult.rows.length > 0) {
      const userEmail = (
        userAccountResult.rows[0].external_email as string
      )?.toLowerCase();
      if (userEmail) {
        await client.execute({
          sql: "DELETE FROM user_connections WHERE user_id = ? AND LOWER(friend_email) = LOWER(?)",
          args: [connection.friend_user_id, userEmail],
        });
      }
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

  const client = getTursoClient();

  // Find the incoming request
  const requestResult = await client.execute({
    sql: "SELECT * FROM user_connections WHERE id = ? AND user_id = ? AND status = 'incoming'",
    args: [friendId, user.userId],
  });

  if (requestResult.rows.length === 0) {
    return res.status(404).json({ error: "Friend request not found" });
  }

  const request = requestResult.rows[0];

  // Update this connection to accepted
  await client.execute({
    sql: "UPDATE user_connections SET status = 'accepted', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    args: [friendId],
  });

  // Update reverse connection to accepted
  if (request.friend_user_id) {
    await client.execute({
      sql: `UPDATE user_connections 
            SET status = 'accepted', updated_at = CURRENT_TIMESTAMP 
            WHERE user_id = ? AND friend_user_id = ? AND status = 'requested'`,
      args: [request.friend_user_id, user.userId],
    });
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

  const client = getTursoClient();

  // Find the incoming request
  const requestResult = await client.execute({
    sql: "SELECT * FROM user_connections WHERE id = ? AND user_id = ? AND status = 'incoming'",
    args: [friendId, user.userId],
  });

  if (requestResult.rows.length === 0) {
    return res.status(404).json({ error: "Friend request not found" });
  }

  const request = requestResult.rows[0];

  // Delete this connection
  await client.execute({
    sql: "DELETE FROM user_connections WHERE id = ?",
    args: [friendId],
  });

  // Delete reverse connection
  if (request.friend_user_id) {
    await client.execute({
      sql: "DELETE FROM user_connections WHERE user_id = ? AND friend_user_id = ? AND status = 'requested'",
      args: [request.friend_user_id, user.userId],
    });
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

  const client = getTursoClient();

  // Check if connection exists and is accepted
  const connectionResult = await client.execute({
    sql: "SELECT * FROM user_connections WHERE id = ? AND user_id = ? AND status = 'accepted'",
    args: [friendId, user.userId],
  });

  if (
    connectionResult.rows.length === 0 ||
    !connectionResult.rows[0].friend_user_id
  ) {
    return res
      .status(404)
      .json({ error: "Friend not found or connection not accepted" });
  }

  const connection = connectionResult.rows[0];
  const friendUserId = connection.friend_user_id as string;

  // Verify mutual acceptance
  const reverseResult = await client.execute({
    sql: "SELECT id FROM user_connections WHERE user_id = ? AND friend_user_id = ? AND status = 'accepted'",
    args: [friendUserId, user.userId],
  });

  if (reverseResult.rows.length === 0) {
    return res
      .status(404)
      .json({ error: "Friend not found or connection not mutually accepted" });
  }

  // Parse query parameters
  const queryString = req.url?.split("?")[1] || "";
  const params = new URLSearchParams(queryString);
  const timeMinParam = params.get("timeMin");
  const timeMaxParam = params.get("timeMax");

  const timeMin = timeMinParam ? new Date(timeMinParam) : new Date();
  const timeMax = timeMaxParam
    ? new Date(timeMaxParam)
    : new Date(Date.now() + 28 * 24 * 60 * 60 * 1000);

  if (timeMinParam && isNaN(timeMin.getTime())) {
    return res.status(400).json({ error: "Invalid timeMin parameter" });
  }
  if (timeMaxParam && isNaN(timeMax.getTime())) {
    return res.status(400).json({ error: "Invalid timeMax parameter" });
  }

  // Get friend's calendar accounts
  const accountsResult = await client.execute({
    sql: "SELECT * FROM calendar_accounts WHERE user_id = ? OR primary_user_id = ?",
    args: [friendUserId, friendUserId],
  });

  const allEvents: Array<Record<string, unknown>> = [];

  for (const account of accountsResult.rows) {
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
          friendConnectionId: friendId,
        }));
        allEvents.push(...events);
      } catch (err) {
        console.error(
          `Error fetching Google events for friend ${friendUserId}:`,
          err,
        );
      }
    }

    // Fetch Outlook events via OneCal
    if (
      account.provider === "outlook" &&
      account.access_token &&
      ONECAL_API_KEY
    ) {
      try {
        const endUserAccountId = account.access_token as string;

        // First, get calendars for this account
        const calendarsResponse = await fetch(
          `${ONECAL_API_BASE}/calendars/${endUserAccountId}`,
          {
            headers: { "x-api-key": ONECAL_API_KEY },
          },
        );

        if (!calendarsResponse.ok) {
          console.error(
            `Failed to fetch Outlook calendars: ${await calendarsResponse.text()}`,
          );
          continue;
        }

        const calendarsData = (await calendarsResponse.json()) as {
          data?: Array<{ id: string; name: string; isPrimary?: boolean }>;
        };
        const calendars = calendarsData.data || [];

        const primaryCalendar = calendars.find((cal) => cal.isPrimary);
        const calendarsToFetch = primaryCalendar
          ? [primaryCalendar]
          : calendars.slice(0, 1);

        for (const cal of calendarsToFetch) {
          const eventsParams = new URLSearchParams({
            startDateTime: timeMin.toISOString(),
            endDateTime: timeMax.toISOString(),
            expandRecurrences: "true",
          });

          const eventsResponse = await fetch(
            `${ONECAL_API_BASE}/events/${endUserAccountId}/${cal.id}?${eventsParams}`,
            { headers: { "x-api-key": ONECAL_API_KEY } },
          );

          if (!eventsResponse.ok) {
            console.error(
              `Failed to fetch Outlook events: ${await eventsResponse.text()}`,
            );
            continue;
          }

          const eventsData = (await eventsResponse.json()) as {
            data?: Array<{
              id: string;
              title?: string;
              summary?: string;
              start?: { dateTime?: string; date?: string };
              end?: { dateTime?: string; date?: string };
            }>;
          };
          const onecalEvents = eventsData.data || [];

          for (const event of onecalEvents) {
            allEvents.push({
              id: event.id,
              summary: event.title || event.summary || "Untitled Event",
              start: {
                dateTime: event.start?.dateTime,
                date: event.start?.date,
              },
              end: {
                dateTime: event.end?.dateTime,
                date: event.end?.date,
              },
              calendarId: cal.id,
              accountType: "outlook",
              accountEmail: account.external_email,
              userId: account.user_id,
              friendConnectionId: friendId,
            });
          }
        }
      } catch (err) {
        console.error(
          `Error fetching Outlook events for friend ${friendUserId}:`,
          err,
        );
      }
    }

    // Fetch iCloud events via CalDAV
    if (account.provider === "icloud" && account.encrypted_password) {
      try {
        // Decrypt the stored password
        const password = decrypt(account.encrypted_password as string);

        // Create CalDAV client
        const davClient = new DAVClient({
          serverUrl: "https://caldav.icloud.com",
          credentials: {
            username: account.external_email as string,
            password: password,
          },
          authMethod: "Basic",
          defaultAccountType: "caldav",
        });

        await davClient.login();
        const calendars = await davClient.fetchCalendars();

        for (const calendar of calendars) {
          const objects = await davClient.fetchCalendarObjects({ calendar });

          for (const obj of objects) {
            if (obj.data) {
              try {
                const parsed = ical.parseICS(obj.data);

                for (const key in parsed) {
                  const event = parsed[key];
                  if (event.type === "VEVENT") {
                    const startDate = event.start;
                    const endDate = event.end;

                    // Filter to only events within the time range
                    if (
                      startDate &&
                      startDate >= timeMin &&
                      startDate <= timeMax
                    ) {
                      allEvents.push({
                        id: event.uid || key,
                        summary: event.summary || "Untitled Event",
                        start: { dateTime: startDate.toISOString() },
                        end: {
                          dateTime: endDate
                            ? endDate.toISOString()
                            : startDate.toISOString(),
                        },
                        calendarId: calendar.url,
                        accountType: "icloud",
                        accountEmail: account.external_email,
                        userId: account.user_id,
                        friendConnectionId: friendId,
                      });
                    }
                  }
                }
              } catch (parseErr) {
                // Skip malformed calendar objects
                console.error(
                  `Error parsing iCloud calendar object for friend ${friendUserId}:`,
                  parseErr,
                );
              }
            }
          }
        }
      } catch (err) {
        console.error(
          `Error fetching iCloud events for friend ${friendUserId}:`,
          err,
        );
      }
    }
  }

  return res.status(200).json(allEvents);
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

  // Validate and sanitize geminiApiKey
  if (typeof geminiApiKey !== "string" || geminiApiKey.trim().length === 0) {
    return res.status(400).json({ error: "Invalid Gemini API key format" });
  }
  // Validate API key format - Google API keys are alphanumeric with underscores and dashes
  const trimmedGeminiApiKey = geminiApiKey.trim();
  if (!/^[A-Za-z0-9_-]+$/.test(trimmedGeminiApiKey)) {
    return res
      .status(400)
      .json({ error: "Gemini API key contains invalid characters" });
  }

  // Validate tone using module-level constant
  const selectedTone: Tone = VALID_TONES.includes(tone) ? tone : "professional";

  // Sanitize inputs
  const safeTitle = sanitizeInput(title, AI_MAX_INPUT_LENGTH);
  const safeDescription = description ? sanitizeInput(description) : "";
  const safeLocation = location
    ? sanitizeInput(location, AI_MAX_INPUT_LENGTH)
    : "";
  const safeAttendees = (attendees ?? [])
    .slice(0, AI_MAX_ATTENDEES)
    .map((a: string) => sanitizeInput(a, AI_MAX_ATTENDEE_LENGTH));

  // Validate datetime format using Date parsing
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
    const genAI = new GoogleGenerativeAI(trimmedGeminiApiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

    // Use validated datetime strings directly (already validated by Date parsing)
    const prompt = buildAIPrompt({
      title: safeTitle,
      description: safeDescription,
      location: safeLocation,
      attendees: safeAttendees,
      start: start,
      end: end,
      tone: selectedTone,
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const draft = sanitizeOutput(text);

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

  // Normalize path: remove trailing slash and ensure it starts with /api
  let path = rawPath.replace(/\/$/, "");
  if (!path.startsWith("/api")) {
    // Handle case where path might be relative or missing /api prefix due to rewriting
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
    if (path === "/api/auth/google") {
      return handleGoogleAuth(res);
    }
    if (path === "/api/auth/google/callback") {
      return handleGoogleCallback(req, res);
    }
    if (path === "/api/auth/exchange") {
      return handleAuthExchange(req, res);
    }
    // Outlook OAuth routes
    if (path === "/api/auth/outlook") {
      return handleOutlookAuth(req, res);
    }
    if (path === "/api/auth/outlook/callback") {
      return handleOutlookCallback(req, res);
    }
    // iCloud auth route
    if (path === "/api/auth/icloud" && req.method === "POST") {
      return handleICloudConnect(req, res);
    }

    // ===================
    // User routes - /api/users/:id
    // ===================
    const userMatch = path.match(/^\/api\/users\/([^/]+)$/);
    if (userMatch) {
      return handleGetUser(userMatch[1], res);
    }

    // ===================
    // Calendar routes
    // ===================

    // GET /api/calendar/all-events/:userId
    const allEventsMatch = path.match(/^\/api\/calendar\/all-events\/([^/]+)$/);
    if (allEventsMatch && req.method === "GET") {
      return handleGetAllEvents(req, res, allEventsMatch[1]);
    }

    // GET /api/calendar/events-stream/:userId - Stream events via SSE
    const eventsStreamMatch = path.match(
      /^\/api\/calendar\/events-stream\/([^/]+)$/,
    );
    if (eventsStreamMatch && req.method === "GET") {
      await handleStreamEvents(req, res, eventsStreamMatch[1]);
      return;
    }

    // POST /api/calendar/events
    if (path === "/api/calendar/events" && req.method === "POST") {
      return handleCreateEvent(req, res);
    }

    // GET /api/calendar/icloud/status
    if (path === "/api/calendar/icloud/status") {
      return handleICloudStatus(req, res);
    }

    // DELETE /api/calendar/icloud/:userId
    const icloudDeleteMatch = path.match(/^\/api\/calendar\/icloud\/([^/]+)$/);
    if (icloudDeleteMatch && req.method === "DELETE") {
      return handleRemoveICloud(req, res, icloudDeleteMatch[1]);
    }

    // GET /api/calendar/outlook/status
    if (path === "/api/calendar/outlook/status") {
      return handleOutlookStatus(req, res);
    }

    // DELETE /api/calendar/outlook/:userId
    const outlookDeleteMatch = path.match(
      /^\/api\/calendar\/outlook\/([^/]+)$/,
    );
    if (outlookDeleteMatch && req.method === "DELETE") {
      return handleRemoveOutlook(req, res, outlookDeleteMatch[1]);
    }

    // ===================
    // Friends routes
    // ===================

    // GET /api/friends
    if (path === "/api/friends" && req.method === "GET") {
      return handleGetFriends(req, res);
    }

    // POST /api/friends
    if (path === "/api/friends" && req.method === "POST") {
      return handleAddFriend(req, res);
    }

    // GET /api/friends/requests/incoming
    if (path === "/api/friends/requests/incoming") {
      return handleGetIncomingRequests(req, res);
    }

    // POST /api/friends/sync-pending
    if (path === "/api/friends/sync-pending" && req.method === "POST") {
      return handleSyncPending(req, res);
    }

    // POST /api/friends/:friendId/accept
    const acceptMatch = path.match(/^\/api\/friends\/(\d+)\/accept$/);
    if (acceptMatch && req.method === "POST") {
      const friendId = parseInt(acceptMatch[1], 10);
      return handleAcceptFriend(req, res, friendId);
    }

    // POST /api/friends/:friendId/reject
    const rejectMatch = path.match(/^\/api\/friends\/(\d+)\/reject$/);
    if (rejectMatch && req.method === "POST") {
      const friendId = parseInt(rejectMatch[1], 10);
      return handleRejectFriend(req, res, friendId);
    }

    // GET /api/friends/:friendId/events
    const friendEventsMatch = path.match(/^\/api\/friends\/(\d+)\/events$/);
    if (friendEventsMatch && req.method === "GET") {
      const friendId = parseInt(friendEventsMatch[1], 10);
      return handleGetFriendEvents(req, res, friendId);
    }

    // DELETE /api/friends/:friendId
    const friendDeleteMatch = path.match(/^\/api\/friends\/(\d+)$/);
    if (friendDeleteMatch && req.method === "DELETE") {
      const friendId = parseInt(friendDeleteMatch[1], 10);
      return handleRemoveFriend(req, res, friendId);
    }

    // ===================
    // AI routes
    // ===================

    // POST /api/ai/draft-invitation
    if (path === "/api/ai/draft-invitation" && req.method === "POST") {
      return handleDraftInvitation(req, res);
    }

    // ===================
    // Utility routes
    // ===================

    // GET /api/privacy - Redirect to privacy policy
    if (path === "/api/privacy" && req.method === "GET") {
      return res.redirect(
        301,
        "https://www.privacypolicies.com/live/206e7238-acb3-4701-ab5c-c102a087fd1a"
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
          "GET /api/auth/outlook",
          "GET /api/auth/outlook/callback",
          "POST /api/auth/exchange",
          "POST /api/auth/icloud",
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
