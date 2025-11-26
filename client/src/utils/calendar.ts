/**
 * Calendar utilities for time range calculations and event parsing
 */

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
    timeMin.setDate(timeMin.getDate() - 14); // 2 weeks before
    timeMin.setHours(0, 0, 0, 0);

    timeMax = new Date(weekStart);
    timeMax.setDate(timeMax.getDate() + 21); // 3 weeks after
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
 */
export function parseEventTime(
  value: string | CalendarEventDateTime | undefined,
): Date {
  if (!value) return new Date();
  if (typeof value === "string") {
    return new Date(value);
  }
  return new Date(value.dateTime || value.date || "");
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
