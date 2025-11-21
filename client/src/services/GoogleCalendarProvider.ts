import { CalendarProvider } from '../interfaces/CalendarProvider';
import { CalendarEvent } from '@shared/types';
import { calendarApi } from './api/calendar';

export class GoogleCalendarProvider implements CalendarProvider {
  constructor(private userId: string) {}

  async getEvents(start: Date, end: Date): Promise<CalendarEvent[]> {
    try {
      // Pass start/end dates to API to filter on server side
      const googleEvents = await calendarApi.getGoogleEvents(this.userId, start, end);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return googleEvents.map((event: any) => {
        // All-day events use 'date' instead of 'dateTime'
        const isAllDay = !!event.start?.date && !event.start?.dateTime;
        const startStr = event.start?.dateTime || event.start?.date;
        const endStr = event.end?.dateTime || event.end?.date;

        return {
          id: event.id,
          userId: this.userId, // Assign to current user
          start: startStr ? new Date(startStr) : new Date(),
          end: endStr ? new Date(endStr) : new Date(),
          title: event.summary || '(No title)',
          isAllDay: isAllDay,
        };
      });
    } catch (error) {
      console.error('Error loading calendar events:', error);
      return [];
    }
  }
}
