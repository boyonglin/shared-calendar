/**
 * Shared Google Auth Service
 *
 * Handles Google OAuth and Calendar API operations.
 */
import { google, type calendar_v3 } from "googleapis";
import {
  calendarAccountRepository,
  type CalendarAccount,
} from "../repositories/index.js";
import { userConnectionRepository } from "../repositories/index.js";
import {
  GOOGLE_OAUTH_SCOPES,
  GOOGLE_REVOKE_URL,
  DEFAULT_API_FETCH_DAYS,
} from "../constants/index.js";
import { createServiceLogger, logServiceError } from "../utils/logger.js";

const logger = createServiceLogger("googleAuth");

/**
 * Google Auth Service interface
 */
interface GoogleAuthService {
  getAuthUrl: (state?: string) => string;
  handleCallback: (code: string) => Promise<{
    user: {
      id: string;
      email: string;
      name: string | null | undefined;
      picture: string | null | undefined;
    };
    tokens: {
      access_token?: string | null;
      refresh_token?: string | null;
      scope?: string;
      token_type?: string | null;
      expiry_date?: number | null;
    };
  }>;
  getUser: (userId: string) => Promise<{
    profile: {
      email: string | null;
      name: string;
      picture: string;
      sub: string;
    };
    provider: string;
  } | null>;
  getCalendarEvents: (
    userId: string,
    timeMin?: Date,
    timeMax?: Date,
  ) => Promise<calendar_v3.Schema$Event[] | undefined>;
  createEvent: (
    userId: string,
    eventData: {
      summary: string;
      description?: string;
      start: { dateTime?: string; date?: string };
      end: { dateTime?: string; date?: string };
      attendees?: { email: string }[];
    },
    account?: CalendarAccount,
  ) => Promise<calendar_v3.Schema$Event>;
  revokeAccount: (userId: string) => Promise<void>;
}

/**
 * Get environment variables
 */
function getConfig() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI,
  };
}

/**
 * Create a base OAuth2 client
 */
function createBaseOAuth2Client() {
  const { clientId, clientSecret, redirectUri } = getConfig();
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth not configured");
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Create an OAuth2 client for a specific user with token refresh handling
 */
function createOAuth2ClientForUser(
  userId: string,
  credentials: { access_token: string; refresh_token?: string },
) {
  const { clientId, clientSecret, redirectUri } = getConfig();
  const client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  client.setCredentials(credentials);

  client.on(
    "tokens",
    async (tokens: {
      access_token?: string | null;
      refresh_token?: string | null;
    }) => {
      try {
        if (tokens.access_token) {
          await calendarAccountRepository.updateAccessToken(
            userId,
            tokens.access_token,
          );
        }
        if (tokens.refresh_token) {
          await calendarAccountRepository.updateRefreshToken(
            userId,
            tokens.refresh_token,
          );
        }
      } catch (error) {
        logServiceError(
          logger,
          error,
          `Failed to refresh tokens for user ${userId}`,
        );
      }
    },
  );

  return client;
}

export const googleAuthService: GoogleAuthService = {
  /**
   * Generate OAuth authorization URL
   */
  getAuthUrl: (state?: string) => {
    const oauth2Client = createBaseOAuth2Client();
    return oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: GOOGLE_OAUTH_SCOPES,
      prompt: "consent",
      state,
    });
  },

  /**
   * Handle OAuth callback
   */
  handleCallback: async (code: string) => {
    const oauth2Client = createBaseOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    if (!userInfo.id || !userInfo.email) {
      throw new Error("Failed to get user info");
    }

    const userId = userInfo.id;
    const metadata = JSON.stringify({
      name: userInfo.name,
      picture: userInfo.picture,
    });

    // Store or update account in DB
    await calendarAccountRepository.upsertGoogleAccount({
      userId,
      email: userInfo.email,
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token || null,
      metadata,
    });

    // Process any pending friend requests
    const normalizedEmail = userInfo.email.toLowerCase();
    const pendingRequests =
      await userConnectionRepository.findPendingRequestsByFriendEmail(
        normalizedEmail,
      );

    for (const request of pendingRequests) {
      await userConnectionRepository.updateFriendUserIdAndStatus(
        request.id,
        userId,
        "requested",
      );

      const requesterAccount = await calendarAccountRepository.findByUserId(
        request.user_id,
      );

      if (requesterAccount?.external_email) {
        const existingIncoming =
          await userConnectionRepository.findByUserIdAndFriendEmail(
            userId,
            requesterAccount.external_email.toLowerCase(),
          );

        if (!existingIncoming) {
          await userConnectionRepository.createOrIgnore(
            userId,
            requesterAccount.external_email.toLowerCase(),
            request.user_id,
            "incoming",
          );
        }
      }
    }

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

  /**
   * Get user profile
   */
  getUser: async (userId: string) => {
    const account = await calendarAccountRepository.findByUserIdAndProvider(
      userId,
      "google",
    );

    if (!account) return null;

    const metadata = JSON.parse(account.metadata || "{}");
    return {
      profile: {
        email: account.external_email,
        name: metadata.name,
        picture: metadata.picture,
        sub: account.user_id,
      },
      provider: "google",
    };
  },

  /**
   * Get calendar events
   */
  getCalendarEvents: async (userId: string, timeMin?: Date, timeMax?: Date) => {
    const account = await calendarAccountRepository.findByUserId(userId);

    if (!account) {
      throw new Error("User not found");
    }

    const userClient = createOAuth2ClientForUser(userId, {
      access_token: account.access_token!,
      refresh_token: account.refresh_token || undefined,
    });

    const calendar = google.calendar({ version: "v3", auth: userClient });

    const now = new Date();
    const defaultTimeMin = now.toISOString();
    const defaultTimeMax = new Date(now.getTime());
    defaultTimeMax.setDate(defaultTimeMax.getDate() + DEFAULT_API_FETCH_DAYS);

    const res = await calendar.events.list({
      calendarId: "primary",
      timeMin: timeMin?.toISOString() || defaultTimeMin,
      timeMax: timeMax?.toISOString() || defaultTimeMax.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
    });

    return res.data.items;
  },

  /**
   * Create a calendar event
   */
  createEvent: async (
    userId: string,
    eventData: {
      summary: string;
      description?: string;
      start: { dateTime?: string; date?: string };
      end: { dateTime?: string; date?: string };
      attendees?: { email: string }[];
    },
    account?: CalendarAccount,
  ) => {
    if (!account) {
      const dbAccount = await calendarAccountRepository.findByUserId(userId);
      if (!dbAccount) {
        throw new Error("User not found");
      }
      account = dbAccount;
    }

    const userClient = createOAuth2ClientForUser(userId, {
      access_token: account.access_token!,
      refresh_token: account.refresh_token || undefined,
    });

    const calendar = google.calendar({ version: "v3", auth: userClient });

    const res = await calendar.events.insert({
      calendarId: "primary",
      requestBody: eventData,
      sendUpdates: "all",
    });

    return res.data;
  },

  /**
   * Revoke user account and delete all data
   */
  revokeAccount: async (userId: string): Promise<void> => {
    const account = await calendarAccountRepository.findByUserId(userId);

    if (account?.access_token) {
      try {
        const response = await fetch(GOOGLE_REVOKE_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: `token=${encodeURIComponent(account.access_token)}`,
        });
        if (!response.ok) {
          logger.warn(
            { status: response.status },
            "Google token revocation failed",
          );
        }
      } catch (error) {
        logServiceError(logger, error, "Failed to revoke token with Google");
      }
    }

    await userConnectionRepository.deleteAllByUserId(userId);
    await calendarAccountRepository.deleteAllByPrimaryUserId(userId);
  },
};
