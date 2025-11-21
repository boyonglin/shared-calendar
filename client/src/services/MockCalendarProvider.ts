import { CalendarProvider } from '../interfaces/CalendarProvider';
import { CalendarEvent } from '@shared/types';

const mockEvents: CalendarEvent[] = [
  // Week 1
  {
    id: '2',
    userId: '2',
    start: new Date(2025, 10, 12, 0, 0),
    end: new Date(2025, 10, 12, 23, 59),
    title: 'Team Offsite',
    isAllDay: true,
  },
  { id: '3', userId: '2', start: new Date(2025, 10, 13, 9, 0), end: new Date(2025, 10, 13, 10, 0) },
  {
    id: '4',
    userId: '2',
    start: new Date(2025, 10, 13, 12, 0),
    end: new Date(2025, 10, 13, 13, 0),
  },
  {
    id: '5',
    userId: '3',
    start: new Date(2025, 10, 14, 13, 0),
    end: new Date(2025, 10, 14, 15, 0),
  },
  {
    id: '6',
    userId: '4',
    start: new Date(2025, 10, 14, 11, 0),
    end: new Date(2025, 10, 14, 12, 0),
  },
  {
    id: '8',
    userId: '2',
    start: new Date(2025, 10, 15, 10, 0),
    end: new Date(2025, 10, 15, 11, 0),
  },
  {
    id: '9',
    userId: '3',
    start: new Date(2025, 10, 15, 14, 0),
    end: new Date(2025, 10, 15, 16, 0),
  },
  // Week 2
  {
    id: '10',
    userId: '4',
    start: new Date(2025, 10, 18, 15, 0),
    end: new Date(2025, 10, 18, 16, 30),
  },
  {
    id: '12',
    userId: '2',
    start: new Date(2025, 10, 19, 14, 0),
    end: new Date(2025, 10, 19, 15, 0),
  },
  {
    id: '13',
    userId: '3',
    start: new Date(2025, 10, 20, 11, 0),
    end: new Date(2025, 10, 20, 12, 30),
  },
  {
    id: '14',
    userId: '4',
    start: new Date(2025, 10, 21, 13, 0),
    end: new Date(2025, 10, 21, 14, 0),
  },
  // Week 3
  {
    id: '15',
    userId: '2',
    start: new Date(2025, 10, 25, 9, 0),
    end: new Date(2025, 10, 25, 10, 30),
  },
  {
    id: '16',
    userId: '3',
    start: new Date(2025, 10, 26, 14, 0),
    end: new Date(2025, 10, 26, 16, 0),
  },
  {
    id: '17',
    userId: '4',
    start: new Date(2025, 10, 27, 10, 0),
    end: new Date(2025, 10, 27, 11, 0),
  },
  // Week 4
  { id: '18', userId: '2', start: new Date(2025, 11, 2, 13, 0), end: new Date(2025, 11, 2, 15, 0) },
  { id: '19', userId: '3', start: new Date(2025, 11, 3, 9, 0), end: new Date(2025, 11, 3, 10, 0) },
  {
    id: '20',
    userId: '4',
    start: new Date(2025, 11, 4, 14, 0),
    end: new Date(2025, 11, 4, 15, 30),
  },
  // Week 5
  { id: '21', userId: '2', start: new Date(2025, 11, 9, 11, 0), end: new Date(2025, 11, 9, 12, 0) },
  {
    id: '22',
    userId: '3',
    start: new Date(2025, 11, 10, 15, 0),
    end: new Date(2025, 11, 10, 16, 0),
  },
  {
    id: '23',
    userId: '4',
    start: new Date(2025, 11, 11, 10, 0),
    end: new Date(2025, 11, 11, 11, 30),
  },
];

export class MockCalendarProvider implements CalendarProvider {
  async getEvents(start: Date, end: Date): Promise<CalendarEvent[]> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    return mockEvents.filter((event) => {
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);
      return eventStart >= start && eventEnd <= end;
    });
  }
}
