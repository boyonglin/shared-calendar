import { CalendarEvent } from '@shared/types';

export interface CalendarProvider {
  getEvents(start: Date, end: Date): Promise<CalendarEvent[]>;
}
