import { google } from "googleapis";
import {
  calendarAccountRepository,
  type CalendarAccount,
} from "../repositories/calendarAccountRepository";
import { userConnectionRepository } from "../repositories/userConnectionRepository";
import { env } from "../config/env";

const CLIENT_ID = env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = env.GOOGLE_REDIRECT_URI;

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

  client.on("tokens", async (tokens) => {
    // Update tokens asynchronously
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

    // For now, we'll use the Google ID as the user_id since we don't have a separate user system yet
    const userId = userInfo.id;

    const metadata = JSON.stringify({
      name: userInfo.name,
      picture: userInfo.picture,
    });

    // Store or update account in DB using async repository
    await calendarAccountRepository.upsertGoogleAccount({
      userId,
      email: userInfo.email,
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token || null,
      metadata,
    });

    // Process any pending friend requests that were sent to this user before they registered
    const normalizedEmail = userInfo.email.toLowerCase();
    const pendingRequests =
      await userConnectionRepository.findPendingRequestsByFriendEmail(
        normalizedEmail,
      );

    // Process pending requests
    for (const request of pendingRequests) {
      // Update the requester's connection to 'requested' status with the new user's ID
      await userConnectionRepository.updateFriendUserIdAndStatus(
        request.id,
        userId,
        "requested",
      );

      // Get the requester's account to find their email
      const requesterAccount = await calendarAccountRepository.findByUserId(
        request.user_id,
      );

      if (requesterAccount?.external_email) {
        // Check if the new user already has a connection for the requester
        const existingIncoming =
          await userConnectionRepository.findByUserIdAndFriendEmail(
            userId,
            requesterAccount.external_email.toLowerCase(),
          );

        if (!existingIncoming) {
          // Create the incoming request for the new user
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

  getUser: async (userId: string) => {
    const account = await calendarAccountRepository.findByUserIdAndProvider(
      userId,
      "google",
    );

    if (!account) return null;

    const metadata = JSON.parse(account.metadata || "{}");
    return {
      // Note: idToken removed for security - access tokens should never be sent to client
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
    const account = await calendarAccountRepository.findByUserId(userId);

    if (!account) {
      console.error(`User not found in DB for userId: ${userId}`);
      throw new Error("User not found");
    }

    const userClient = createOAuth2ClientForUser(userId, {
      access_token: account.access_token!,
      refresh_token: account.refresh_token || undefined,
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
};
