import type { CalendarEvent } from "@shared/types";

/**
 * Interface for calendar providers
 */
export interface CalendarProvider {
  getEvents(start: Date, end: Date): Promise<CalendarEvent[]>;
}
