import type { CalendarProvider } from "../interfaces/CalendarProvider";
import type { CalendarEvent } from "@shared/types";
import type { RawCalendarEvent } from "./api/calendar";
import { calendarApi } from "./api/calendar";

/**
 * Unified provider that fetches events from all connected calendar accounts
 * (Google, iCloud, etc.) for the authenticated user.
 */
export class UnifiedCalendarProvider implements CalendarProvider {
  constructor(private userId: string) {}

  private formatLocalDate(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private transformEvent(event: RawCalendarEvent): CalendarEvent {
    // Handle both Google Calendar format and iCloud format
    const startObj = typeof event.start === "object" ? event.start : null;
    const endObj = typeof event.end === "object" ? event.end : null;

    const isAllDay = !!startObj?.date && !startObj?.dateTime;
    const startStr = startObj?.dateTime || startObj?.date || event.start;
    const endStr = endObj?.dateTime || endObj?.date || event.end;

    return {
      id: event.id,
      userId: this.userId, // Normalize all events to the primary user ID
      start:
        typeof startStr === "string"
          ? new Date(startStr)
          : (startStr as Date),
      end: typeof endStr === "string" ? new Date(endStr) : (endStr as Date),
      title: event.summary || event.title || "(No title)",
      isAllDay: isAllDay,
    };
  }

  async getEvents(start: Date, end: Date): Promise<CalendarEvent[]> {
    try {
      // Fetch events from all connected accounts with date filtering
      const events = await calendarApi.getAllEvents(this.userId, start, end);

      return events.map((event: RawCalendarEvent) => this.transformEvent(event));
    } catch (error) {
      console.error("Failed to fetch unified events:", error);
      return [];
    }
  }

  /**
   * Stream events from all connected calendar accounts
   * Events are delivered progressively as each provider completes
   */
  streamEvents(
    start: Date,
    end: Date,
    onEvents: (events: CalendarEvent[], provider: string) => void,
    onComplete: () => void,
    onError?: (error: Error) => void,
  ): AbortController {
    return calendarApi.streamAllEvents(
      this.userId,
      start,
      end,
      (rawEvents: RawCalendarEvent[], provider: string) => {
        const transformedEvents = rawEvents.map((event) =>
          this.transformEvent(event),
        );
        onEvents(transformedEvents, provider);
      },
      onComplete,
      onError,
    );
  }

  async createEvent(event: {
    title: string;
    description?: string;
    start: Date;
    end: Date;
    attendees?: string[];
    isAllDay?: boolean;
  }): Promise<CalendarEvent> {
    try {
      const response = await calendarApi.createEvent({
        title: event.title,
        description: event.description,
        start: event.isAllDay
          ? this.formatLocalDate(event.start)
          : event.start.toISOString(),
        end: event.isAllDay
          ? this.formatLocalDate(event.end)
          : event.end.toISOString(),
        attendees: event.attendees,
        isAllDay: event.isAllDay,
      });

      const rawEvent = response;
      const startObj =
        typeof rawEvent.start === "object" ? rawEvent.start : null;
      const endObj = typeof rawEvent.end === "object" ? rawEvent.end : null;
      const startStr = startObj?.dateTime || startObj?.date || rawEvent.start;
      const endStr = endObj?.dateTime || endObj?.date || rawEvent.end;

      return {
        id: rawEvent.id,
        userId: this.userId,
        start:
          typeof startStr === "string"
            ? new Date(startStr)
            : (startStr as Date),
        end: typeof endStr === "string" ? new Date(endStr) : (endStr as Date),
        title: rawEvent.summary || rawEvent.title || "(No title)",
        isAllDay: !!startObj?.date && !startObj?.dateTime,
      };
    } catch (error) {
      console.error("Failed to create event:", error);
      throw error;
    }
  }
}
