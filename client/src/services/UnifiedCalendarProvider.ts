import type { CalendarProvider } from "../interfaces/CalendarProvider";
import type { CalendarEvent } from "@shared/types";
import type { RawCalendarEvent } from "./api/calendar";
import { calendarApi } from "./api/calendar";
import { transformRawEvent } from "@/utils/eventTransform";

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

  async getEvents(start: Date, end: Date): Promise<CalendarEvent[]> {
    try {
      // Fetch events from all connected accounts with date filtering
      const events = await calendarApi.getAllEvents(this.userId, start, end);

      return events.map((event: RawCalendarEvent) =>
        transformRawEvent(event, { userId: this.userId }),
      );
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
          transformRawEvent(event, { userId: this.userId }),
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

      // Use shared transformation for the created event
      return transformRawEvent(response, { userId: this.userId });
    } catch (error) {
      console.error("Failed to create event:", error);
      throw error;
    }
  }
}
