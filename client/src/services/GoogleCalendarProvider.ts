import { CalendarProvider } from '../interfaces/CalendarProvider';
import { CalendarEvent } from '@shared/types';
import { GoogleCalendarEvent } from '../types/google';

export class GoogleCalendarProvider implements CalendarProvider {
    constructor(private userId: string) { }

    async getEvents(_start: Date, _end: Date): Promise<CalendarEvent[]> {
        try {
            // TODO: Pass start/end dates to API to filter on server side
            // For now, we'll fetch all and filter client side or rely on default API behavior
            const res = await fetch(`http://localhost:3001/api/calendar/${this.userId}/events`);
            if (!res.ok) throw new Error('Failed to fetch events');

            const googleEvents: GoogleCalendarEvent[] = await res.json();

            return googleEvents.map(event => {
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
