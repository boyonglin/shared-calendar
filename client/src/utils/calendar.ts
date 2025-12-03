/**
 * Calendar utilities for time range calculations and event parsing
 */

import { convertToViewerTimezone } from "@/utils/timezone";
import {
  CALENDAR_FETCH_DAYS_BEFORE,
  CALENDAR_FETCH_DAYS_AFTER,
} from "@shared/core/constants/index";

/**
 * Calculate time range for fetching calendar events
 * @param weekStart - The start date of the current week
 * @returns Object with timeMin and timeMax dates
 */
export function calculateEventTimeRange(weekStart?: Date): {
  timeMin: Date;
  timeMax: Date;
} {
  let timeMin: Date;
  let timeMax: Date;

  if (weekStart) {
    timeMin = new Date(weekStart);
    timeMin.setDate(timeMin.getDate() - CALENDAR_FETCH_DAYS_BEFORE);
    timeMin.setHours(0, 0, 0, 0);

    timeMax = new Date(weekStart);
    timeMax.setDate(timeMax.getDate() + CALENDAR_FETCH_DAYS_AFTER);
    timeMax.setHours(23, 59, 59, 999);
  } else {
    const now = new Date();
    timeMin = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    timeMax = new Date(now.getFullYear(), now.getMonth() + 2, 0);
  }

  return { timeMin, timeMax };
}

export interface CalendarEventDateTime {
  dateTime?: string;
  date?: string;
}

/**
 * Parse calendar event times from various formats
 * Handles both string and object formats (with dateTime or date properties)
 *
 * This function now uses timezone-aware conversion to ensure events
 * are displayed correctly in the viewer's local timezone.
 *
 * @param value - Event time in string or object format
 * @returns Date object in the viewer's local timezone
 */
export function parseEventTime(
  value: string | CalendarEventDateTime | undefined,
): Date {
  return convertToViewerTimezone(value);
}

/**
 * Determine if an event is an all-day event based on start/end format
 */
export function isAllDayEvent(
  start: string | CalendarEventDateTime | undefined,
  end: string | CalendarEventDateTime | undefined,
): boolean {
  return !!(
    (typeof start === "object" && start?.date) ||
    (typeof end === "object" && end?.date)
  );
}
