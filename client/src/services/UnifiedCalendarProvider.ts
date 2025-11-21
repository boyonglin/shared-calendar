import { CalendarProvider } from '../interfaces/CalendarProvider';
import { CalendarEvent } from '@shared/types';
import { calendarApi, RawCalendarEvent } from './api/calendar';

/**
 * Unified provider that fetches events from all connected calendar accounts
 * (Google, iCloud, etc.) for the authenticated user.
 */
export class UnifiedCalendarProvider implements CalendarProvider {
  constructor(private userId: string) {}

  async getEvents(start: Date, end: Date): Promise<CalendarEvent[]> {
    try {
      // Fetch events from all connected accounts with date filtering
      const events = await calendarApi.getAllEvents(this.userId, start, end);

      return events.map((event: RawCalendarEvent) => {
        // Handle both Google Calendar format and iCloud format
        const startObj = typeof event.start === 'object' ? event.start : null;
        const endObj = typeof event.end === 'object' ? event.end : null;

        const isAllDay = !!startObj?.date && !startObj?.dateTime;
        const startStr = startObj?.dateTime || startObj?.date || event.start;
        const endStr = endObj?.dateTime || endObj?.date || event.end;

        return {
          id: event.id,
          userId: event.userId || this.userId,
          start: typeof startStr === 'string' ? new Date(startStr) : (startStr as Date),
          end: typeof endStr === 'string' ? new Date(endStr) : (endStr as Date),
          title: event.summary || event.title || '(No title)',
          isAllDay: isAllDay,
        };
      });
    } catch (error) {
      console.error('Error loading calendar events:', error);
      return [];
    }
  }
}
