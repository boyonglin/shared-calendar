/**
 * Timezone utilities for cross-timezone calendar event handling
 *
 * This module handles the conversion of calendar events between different timezones.
 * When users in different timezones share calendars, events need to be displayed
 * in the viewer's local timezone, not the creator's timezone.
 *
 * Key concepts:
 * - Events are typically stored in UTC or with timezone offset (ISO 8601)
 * - When displaying events, they should be converted to the viewer's local timezone
 * - All-day events are special: they represent a calendar date, not a specific moment in time
 */

/**
 * Get the user's local timezone
 * @returns The IANA timezone identifier (e.g., "America/New_York", "Asia/Tokyo")
 */
export function getUserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Parse a date string and ensure it's interpreted in the viewer's local timezone
 *
 * ISO 8601 date strings like "2024-11-26T14:00:00-05:00" (EST) or
 * "2024-11-26T19:00:00Z" (UTC) are automatically converted to local time
 * by JavaScript's Date constructor.
 *
 * @param dateString - ISO 8601 date string with timezone info
 * @returns Date object in local timezone
 */
export function parseToLocalTime(dateString: string): Date {
  // JavaScript's Date constructor handles ISO 8601 strings with timezone offsets correctly
  // It converts them to the local timezone automatically
  const date = new Date(dateString);

  // Validate the date
  if (isNaN(date.getTime())) {
    console.warn("Invalid date string: %s", dateString);
    return new Date();
  }

  return date;
}

/**
 * Parse a date-only string (all-day event) preserving the calendar date
 *
 * All-day events like "2024-11-26" represent a calendar date, not a moment in time.
 * They should display as the same date regardless of timezone.
 *
 * For example, "November 26" in the creator's calendar should show as
 * "November 26" for all viewers, even if they're in different timezones.
 *
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Date object representing the start of that day in local timezone
 */
export function parseAllDayDate(dateString: string): Date {
  // Split the date string to get year, month, day
  const [year, month, day] = dateString.split("-").map(Number);

  // Create date in local timezone at midnight
  // This preserves the calendar date regardless of timezone
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

/**
 * Convert an event time to the viewer's local timezone
 *
 * This is the main function for timezone conversion. It handles both:
 * - DateTime events (specific moment in time): converted to local timezone
 * - All-day events (calendar date): preserved as the same date
 *
 * @param value - The event time value (string, or object with dateTime/date)
 * @returns Date object in the viewer's local timezone
 */
export function convertToViewerTimezone(
  value: string | { dateTime?: string; date?: string } | undefined,
): Date {
  if (!value) {
    return new Date();
  }

  // Handle string format (already ISO 8601 with timezone)
  if (typeof value === "string") {
    // Check if it's a date-only string (all-day event format: YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return parseAllDayDate(value);
    }
    return parseToLocalTime(value);
  }

  // Handle object format { dateTime?: string, date?: string }
  if (value.date) {
    // All-day event - preserve calendar date
    return parseAllDayDate(value.date);
  }

  if (value.dateTime) {
    // DateTime event - convert to local timezone
    return parseToLocalTime(value.dateTime);
  }

  return new Date();
}
