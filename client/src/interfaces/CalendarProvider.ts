import type { CalendarEvent } from "@shared/types";

/**
 * Interface for calendar providers
 */
export interface CalendarProvider {
  getEvents(start: Date, end: Date): Promise<CalendarEvent[]>;
  createEvent?(event: {
    title: string;
    description?: string;
    start: Date;
    end: Date;
    attendees?: string[];
    isAllDay?: boolean;
  }): Promise<CalendarEvent>;
}
