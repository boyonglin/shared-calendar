/**
 * Shared event transformation utilities
 *
 * Provides consistent transformation of raw calendar events from various
 * providers (Google, iCloud, Outlook) into the standardized CalendarEvent format.
 */
import type { CalendarEvent } from "@shared/types";
import type { RawCalendarEvent } from "@/services/api/calendar";
import { convertToViewerTimezone } from "./timezone";

/**
 * Raw event datetime format - can be string or object with dateTime/date
 */
export type RawEventDateTime = string | { dateTime?: string; date?: string };

/**
 * Options for transforming raw events
 */
export interface TransformEventOptions {
  /** User ID to assign to the event */
  userId: string;
  /** Optional friend connection ID for friend events */
  friendConnectionId?: number;
}

/**
 * Check if a raw datetime value represents an all-day event
 */
export function isRawAllDayEvent(
  start: RawEventDateTime | undefined,
  end: RawEventDateTime | undefined,
): boolean {
  const startObj = typeof start === "object" ? start : null;
  const endObj = typeof end === "object" ? end : null;
  return !!(startObj?.date || endObj?.date);
}

/**
 * Parse a raw datetime value to a Date object
 * Handles both string and object formats from various calendar providers
 */
export function parseRawDateTime(value: RawEventDateTime | undefined): Date {
  if (!value) {
    return new Date();
  }

  if (typeof value === "string") {
    return convertToViewerTimezone(value);
  }

  // Object format: { dateTime?: string, date?: string }
  return convertToViewerTimezone(value);
}

/**
 * Transform a raw calendar event into a standardized CalendarEvent
 *
 * This is the single source of truth for event transformation across the app.
 * Used by both UnifiedCalendarProvider and useFriends hook.
 *
 * @param event - Raw event from calendar API
 * @param options - Transformation options including userId
 * @returns Standardized CalendarEvent
 */
export function transformRawEvent(
  event: RawCalendarEvent,
  options: TransformEventOptions,
): CalendarEvent {
  const { userId, friendConnectionId } = options;

  const startValue = event.start;
  const endValue = event.end;

  const isAllDay = isRawAllDayEvent(startValue, endValue);
  const start = parseRawDateTime(startValue);
  const end = parseRawDateTime(endValue);

  const calendarEvent: CalendarEvent = {
    id: event.id,
    userId,
    start,
    end,
    title: event.summary || event.title || "(No title)",
    isAllDay,
  };

  // Add friendConnectionId if this is a friend's event
  if (friendConnectionId !== undefined) {
    calendarEvent.friendConnectionId = friendConnectionId;
  }

  return calendarEvent;
}

/**
 * Transform multiple raw events
 */
export function transformRawEvents(
  events: RawCalendarEvent[],
  options: TransformEventOptions,
): CalendarEvent[] {
  return events.map((event) => transformRawEvent(event, options));
}
