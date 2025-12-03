/**
 * Shared OneCal Auth Service
 *
 * Handles Outlook/Microsoft Calendar integration via OneCal API.
 */
import { calendarAccountRepository } from "../repositories/index.js";
import { ONECAL_API_BASE } from "../constants/index.js";

interface OnecalEndUserAccount {
  id: string;
  email: string;
  providerType: "MICROSOFT" | "GOOGLE";
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface OnecalCalendar {
  id: string;
  name: string;
  readOnly: boolean;
  hexColor?: string;
  timeZone?: string;
  isPrimary?: boolean;
}

interface OnecalEvent {
  id: string;
  title?: string;
  summary?: string;
  start?: {
    dateTime?: string;
    date?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
  };
}

interface TransformedEvent {
  id: string;
  summary: string;
  start: { dateTime?: string };
  end: { dateTime?: string };
}

/**
 * Get environment variables
 */
function getConfig() {
  return {
    appId: process.env.ONECAL_APP_ID,
    apiKey: process.env.ONECAL_API_KEY,
    redirectUri:
      process.env.ONECAL_REDIRECT_URI ||
      process.env.GOOGLE_REDIRECT_URI?.replace(
        "/google/callback",
        "/outlook/callback",
      ) ||
      "http://localhost:3001/api/auth/outlook/callback",
  };
}

/**
 * Build redirect URL based on environment
 */
function getRedirectUrl(): string {
  const { redirectUri } = getConfig();
  return redirectUri;
}

export const onecalAuthService = {
  /**
   * Generate OAuth authorization URL
   */
  getAuthUrl: () => {
    const { appId } = getConfig();
    if (!appId) {
      throw new Error("ONECAL_APP_ID is not configured");
    }
    const redirectUrl = getRedirectUrl();
    return `${ONECAL_API_BASE}/oauth/authorize/${appId}/microsoft?redirectUrl=${encodeURIComponent(redirectUrl)}`;
  },

  /**
   * Handle OAuth callback
   */
  handleCallback: async (endUserAccountId: string, primaryUserId?: string) => {
    const { apiKey } = getConfig();
    if (!apiKey) {
      throw new Error("ONECAL_API_KEY is not configured");
    }

    const response = await fetch(
      `${ONECAL_API_BASE}/endUserAccounts/${endUserAccountId}`,
      {
        headers: { "x-api-key": apiKey },
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch OneCal account: ${error}`);
    }

    const account = (await response.json()) as OnecalEndUserAccount;

    const metadata = JSON.stringify({
      name: account.email,
      providerType: account.providerType,
      status: account.status,
    });

    await calendarAccountRepository.upsertOutlookAccount({
      userId: endUserAccountId,
      email: account.email,
      endUserAccountId: endUserAccountId,
      metadata,
      primaryUserId: primaryUserId || null,
    });

    return {
      user: {
        id: endUserAccountId,
        email: account.email,
        provider: "outlook",
      },
    };
  },

  /**
   * Get calendar events from Outlook
   */
  getCalendarEvents: async (userId: string, timeMin?: Date, timeMax?: Date) => {
    const { apiKey } = getConfig();
    if (!apiKey) {
      throw new Error("ONECAL_API_KEY is not configured");
    }

    const account = await calendarAccountRepository.findByUserIdAndProvider(
      userId,
      "outlook",
    );

    if (!account) {
      throw new Error("Outlook account not found");
    }

    const endUserAccountId = account.access_token;

    const calendarsResponse = await fetch(
      `${ONECAL_API_BASE}/calendars/${endUserAccountId}`,
      {
        headers: { "x-api-key": apiKey },
      },
    );

    if (!calendarsResponse.ok) {
      const error = await calendarsResponse.text();
      throw new Error(`Failed to fetch calendars: ${error}`);
    }

    const calendarsData = (await calendarsResponse.json()) as {
      data?: OnecalCalendar[];
    };
    const allCalendars: OnecalCalendar[] = calendarsData.data || [];

    const primaryCalendar = allCalendars.find((cal) => cal.isPrimary);
    const calendars = primaryCalendar
      ? [primaryCalendar]
      : allCalendars.slice(0, 1);

    const allEvents: TransformedEvent[] = [];
    const now = timeMin || new Date();
    const fourWeeksLater =
      timeMax || new Date(new Date().setDate(new Date().getDate() + 28));

    for (const calendar of calendars) {
      try {
        const params = new URLSearchParams({
          startDateTime: now.toISOString(),
          endDateTime: fourWeeksLater.toISOString(),
          expandRecurrences: "true",
        });

        const eventsResponse = await fetch(
          `${ONECAL_API_BASE}/events/${endUserAccountId}/${calendar.id}?${params}`,
          { headers: { "x-api-key": apiKey } },
        );

        if (!eventsResponse.ok) continue;

        const eventsData = (await eventsResponse.json()) as {
          data?: OnecalEvent[];
        };
        const events: OnecalEvent[] = eventsData.data || [];

        for (const event of events) {
          allEvents.push({
            id: event.id,
            summary: event.title || event.summary || "Untitled Event",
            start: { dateTime: event.start?.dateTime || event.start?.date },
            end: { dateTime: event.end?.dateTime || event.end?.date },
          });
        }
      } catch (error) {
        console.error(
          `Error fetching events from calendar ${calendar.id}:`,
          error,
        );
      }
    }

    return allEvents;
  },
};
