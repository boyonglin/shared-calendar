/**
 * Calendar event utilities for parsing and transforming calendar data
 */

export interface CalendarEventDateTime {
  dateTime?: string;
  date?: string;
}

export interface RawCalendarEvent {
  id?: string;
  summary?: string;
  title?: string;
  start?: string | CalendarEventDateTime;
  end?: string | CalendarEventDateTime;
  [key: string]: unknown;
}

export interface ParsedEventTime {
  start: Date;
  end: Date;
  isAllDay: boolean;
}

/**
 * Parse calendar event start/end times from various formats
 * Handles both string and object formats (with dateTime or date properties)
 */
export function parseEventTimes(event: RawCalendarEvent): ParsedEventTime {
  const parseDateTime = (
    value: string | CalendarEventDateTime | undefined,
  ): Date => {
    if (!value) return new Date();
    if (typeof value === "string") {
      return new Date(value);
    }
    return new Date(value.dateTime || value.date || "");
  };

  const isAllDayEvent = (
    start: string | CalendarEventDateTime | undefined,
    end: string | CalendarEventDateTime | undefined,
  ): boolean => {
    // Check if start or end has a date property (indicates all-day event)
    return !!(
      (typeof start === "object" && start?.date) ||
      (typeof end === "object" && end?.date)
    );
  };

  return {
    start: parseDateTime(event.start),
    end: parseDateTime(event.end),
    isAllDay: isAllDayEvent(event.start, event.end),
  };
}

/**
 * Get the display title from a calendar event
 * Handles both 'summary' (Google) and 'title' formats
 */
export function getEventTitle(event: RawCalendarEvent): string | undefined {
  return event.title || event.summary;
}
