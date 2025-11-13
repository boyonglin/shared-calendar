import { GoogleUser, GoogleCalendarEvent } from '../types/google';
import {
  GOOGLE_USERINFO_URL,
  GOOGLE_CALENDAR_API_BASE,
  CALENDAR_DAYS_TO_FETCH,
  CALENDAR_MAX_RESULTS,
  MONDAY_OFFSET,
  SUNDAY_ADJUSTMENT,
  DAY_START_HOUR,
  DAY_START_MINUTE,
  DAY_START_SECOND,
  DAY_START_MILLISECOND,
  DAY_END_HOUR,
  DAY_END_MINUTE,
  DAY_END_SECOND,
  DAY_END_MILLISECOND,
} from '../constants/google';

/**
 * Fetch user profile from Google OAuth2 API
 */
export async function fetchUserProfile(accessToken: string): Promise<GoogleUser> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    throw new Error('Failed to fetch user profile');
  }

  const profile = await res.json();
  return {
    idToken: accessToken,
    profile: {
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
      sub: profile.id,
    },
  };
}

/**
 * Fetch calendar events for the next 4 weeks from Google Calendar API
 */
export async function fetchCalendarEvents(accessToken: string): Promise<GoogleCalendarEvent[]> {
  // Start from the beginning of current week (Monday)
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? SUNDAY_ADJUSTMENT : MONDAY_OFFSET);
  const weekStart = new Date(now);
  weekStart.setDate(diff);
  weekStart.setHours(DAY_START_HOUR, DAY_START_MINUTE, DAY_START_SECOND, DAY_START_MILLISECOND);

  const timeMin = weekStart.toISOString();

  // End at the end of current week + 3 weeks (total 4 weeks)
  const timeMax = new Date(weekStart);
  timeMax.setDate(timeMax.getDate() + CALENDAR_DAYS_TO_FETCH);
  timeMax.setHours(DAY_END_HOUR, DAY_END_MINUTE, DAY_END_SECOND, DAY_END_MILLISECOND);

  const url = `${GOOGLE_CALENDAR_API_BASE}/calendars/primary/events?timeMin=${encodeURIComponent(
    timeMin
  )}&timeMax=${encodeURIComponent(
    timeMax.toISOString()
  )}&singleEvents=true&orderBy=startTime&maxResults=${CALENDAR_MAX_RESULTS}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Calendar API error: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data.items || [];
}
