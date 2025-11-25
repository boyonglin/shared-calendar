import { google } from "googleapis";
import { db } from "../db";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI ||
  "http://localhost:3001/api/auth/google/callback";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.warn("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
}

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI,
);

function createOAuth2ClientForUser(
  userId: string,
  credentials: { access_token: string; refresh_token?: string },
) {
  const client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
  client.setCredentials(credentials);

  client.on("tokens", (tokens) => {
    if (tokens.access_token) {
      const updateStmt = db.prepare(
        "UPDATE calendar_accounts SET access_token = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
      );
      updateStmt.run(tokens.access_token, userId);
    }
    if (tokens.refresh_token) {
      const updateStmt = db.prepare(
        "UPDATE calendar_accounts SET refresh_token = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
      );
      updateStmt.run(tokens.refresh_token, userId);
    }
  });

  return client;
}

export const googleAuthService = {
  getAuthUrl: () => {
    const scopes = [
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/calendar.events",
    ];

    return oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
      prompt: "consent", // Force consent to ensure we get a refresh token
    });
  },

  handleCallback: async (code: string) => {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    if (!userInfo.id || !userInfo.email) {
      throw new Error("Failed to get user info");
    }

    // Store or update account in DB
    const stmt = db.prepare(`
      INSERT INTO calendar_accounts (
        user_id, provider, external_email, access_token, refresh_token, metadata, updated_at
      ) VALUES (?, 'google', ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        access_token = excluded.access_token,
        refresh_token = COALESCE(excluded.refresh_token, calendar_accounts.refresh_token),
        updated_at = CURRENT_TIMESTAMP
    `);

    // For now, we'll use the Google ID as the user_id since we don't have a separate user system yet
    // In a real app, we'd map this to an internal user ID
    const userId = userInfo.id;

    const metadata = JSON.stringify({
      name: userInfo.name,
      picture: userInfo.picture,
    });

    // Note: tokens.refresh_token might be undefined if the user has already authorized the app
    // and we didn't force consent. But we are forcing consent above.
    // If it's still missing, we should probably keep the old one (handled by COALESCE above)

    stmt.run(
      userId,
      userInfo.email,
      tokens.access_token,
      tokens.refresh_token || null,
      // Schema allows NULL (required for iCloud), but we prefer having one for Google.
      // We force 'prompt: consent' to try and get one.
      metadata,
    );

    return {
      user: {
        id: userId,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
      },
      tokens,
    };
  },

  getUser: (userId: string) => {
    const stmt = db.prepare(
      "SELECT * FROM calendar_accounts WHERE user_id = ? AND provider = 'google'",
    );
    const account = stmt.get(userId) as
      | {
          user_id: string;
          metadata?: string;
          external_email?: string;
          access_token: string;
        }
      | undefined;

    if (!account) return null;

    const metadata = JSON.parse(account.metadata || "{}");
    return {
      idToken: account.access_token, // Client expects this but we shouldn't send it really. Keeping for compat.
      profile: {
        email: account.external_email,
        name: metadata.name,
        picture: metadata.picture,
        sub: account.user_id,
      },
      provider: "google",
    };
  },

  getCalendarEvents: async (userId: string, timeMin?: Date, timeMax?: Date) => {
    const stmt = db.prepare(
      "SELECT * FROM calendar_accounts WHERE user_id = ?",
    );
    const account = stmt.get(userId) as
      | { user_id: string; access_token: string; refresh_token?: string }
      | undefined;

    if (!account) {
      console.error(`User not found in DB for userId: ${userId}`);
      throw new Error("User not found");
    }

    const userClient = createOAuth2ClientForUser(userId, {
      access_token: account.access_token,
      refresh_token: account.refresh_token,
    });

    const calendar = google.calendar({ version: "v3", auth: userClient });

    // Use provided dates or default to now + 4 weeks
    const now = new Date();
    const defaultTimeMin = now.toISOString();
    const defaultTimeMax = new Date(now.getTime());
    defaultTimeMax.setDate(defaultTimeMax.getDate() + 28);

    const res = await calendar.events.list({
      calendarId: "primary",
      timeMin: timeMin?.toISOString() || defaultTimeMin,
      timeMax: timeMax?.toISOString() || defaultTimeMax.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
    });

    return res.data.items;
  },

  createEvent: async (
    userId: string,
    eventData: {
      summary: string;
      description?: string;
      start: { dateTime?: string; date?: string };
      end: { dateTime?: string; date?: string };
      attendees?: { email: string }[];
    },
    account?: { access_token: string; refresh_token?: string },
  ) => {
    if (!account) {
      const stmt = db.prepare(
        "SELECT * FROM calendar_accounts WHERE user_id = ?",
      );
      const dbAccount = stmt.get(userId) as
        | { user_id: string; access_token: string; refresh_token?: string }
        | undefined;

      if (!dbAccount) {
        throw new Error("User not found");
      }
      account = dbAccount;
    }

    const userClient = createOAuth2ClientForUser(userId, {
      access_token: account.access_token,
      refresh_token: account.refresh_token,
    });

    const calendar = google.calendar({ version: "v3", auth: userClient });

    const res = await calendar.events.insert({
      calendarId: "primary",
      requestBody: eventData,
      sendUpdates: "all",
    });

    return res.data;
  },
};
