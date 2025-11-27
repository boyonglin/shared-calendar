import { calendarAccountRepository } from "../repositories/calendarAccountRepository";
import { env } from "../config/env";

const ONECAL_API_BASE = "https://api.onecalunified.com/api/v1";
const ONECAL_APP_ID = env.ONECAL_APP_ID;
const ONECAL_API_KEY = env.ONECAL_API_KEY;

if (!ONECAL_APP_ID || !ONECAL_API_KEY) {
  console.warn(
    "Missing OneCal credentials - Outlook Calendar integration will not work",
  );
}

// Build redirect URL based on environment
const getRedirectUrl = () => {
  const baseUrl = env.CLIENT_URL.replace(/\/$/, "");
  return `${baseUrl}/api/auth/outlook/callback`;
};

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

interface _CalendarAccount {
  user_id: string;
  provider: string;
  access_token: string;
  external_email?: string;
}

interface TransformedEvent {
  id: string;
  summary: string;
  start: { dateTime?: string };
  end: { dateTime?: string };
}

export const onecalAuthService = {
  getAuthUrl: () => {
    if (!ONECAL_APP_ID) {
      throw new Error("ONECAL_APP_ID is not configured");
    }
    // Include redirectUrl parameter to ensure correct callback URL
    const redirectUrl = getRedirectUrl();
    return `${ONECAL_API_BASE}/oauth/authorize/${ONECAL_APP_ID}/microsoft?redirectUrl=${encodeURIComponent(redirectUrl)}`;
  },

  handleCallback: async (endUserAccountId: string, primaryUserId?: string) => {
    if (!ONECAL_API_KEY) {
      throw new Error("ONECAL_API_KEY is not configured");
    }

    const response = await fetch(
      `${ONECAL_API_BASE}/endUserAccounts/${endUserAccountId}`,
      {
        headers: { "x-api-key": ONECAL_API_KEY },
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

    // Store using async repository
    // Note: For Outlook/OneCal, we store endUserAccountId in access_token field
    // since OneCal handles token management internally
    await calendarAccountRepository.upsertOutlookAccount({
      userId: endUserAccountId,
      email: account.email,
      metadata,
      primaryUserId: primaryUserId || null,
    });

    // Also update access_token to store endUserAccountId
    await calendarAccountRepository.updateAccessToken(
      endUserAccountId,
      endUserAccountId,
    );

    return {
      user: {
        id: endUserAccountId,
        email: account.email,
        provider: "outlook",
      },
    };
  },

  getCalendarEvents: async (userId: string, timeMin?: Date, timeMax?: Date) => {
    if (!ONECAL_API_KEY) {
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
        headers: { "x-api-key": ONECAL_API_KEY },
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
          { headers: { "x-api-key": ONECAL_API_KEY } },
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
