import type { CalendarProvider } from "@/interfaces/CalendarProvider";
import type { CalendarEvent } from "@shared/types";

/**
 * Mock calendar provider for testing/demo purposes
 * Returns empty array when no user is authenticated
 */
export class MockCalendarProvider implements CalendarProvider {
  async getEvents(_start: Date, _end: Date): Promise<CalendarEvent[]> {
    void _start;
    void _end;
    return [];
  }
}
