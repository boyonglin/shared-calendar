/**
 * Mock data for demonstration purposes
 * Used when the user has no friends connected yet
 */
import type { User, CalendarEvent } from "@shared/types";

/**
 * Check if mock data should be used
 * Can be controlled via environment variable for production
 */
export const ENABLE_MOCK_DATA =
  import.meta.env.VITE_ENABLE_MOCK_DATA !== "false";

/**
 * Mock users for demonstration
 */
export const mockUsers: User[] = [
  {
    id: "mock-2",
    name: "Sarah Johnson",
    email: "sarah@example.com",
    color: "#10b981",
  },
  {
    id: "mock-3",
    name: "Michael Brown",
    email: "michael@example.com",
    color: "#f59e0b",
  },
  {
    id: "mock-4",
    name: "Emma Davis",
    email: "emma@example.com",
    color: "#8b5cf6",
  },
];

/**
 * Generate mock events for a given time period
 * Events are generated relative to the current date
 */
export function generateMockEvents(baseDate?: Date): CalendarEvent[] {
  const today = baseDate || new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  // Helper to create a date relative to today
  const createDate = (
    dayOffset: number,
    hour: number,
    minute: number = 0,
  ): Date => {
    const date = new Date(year, month, today.getDate() + dayOffset);
    date.setHours(hour, minute, 0, 0);
    return date;
  };

  return [
    // Current week
    {
      id: "mock-event-1",
      userId: "mock-2",
      start: createDate(0, 0),
      end: createDate(0, 23, 59),
      title: "Team Offsite",
      isAllDay: true,
    },
    {
      id: "mock-event-2",
      userId: "mock-2",
      start: createDate(1, 9),
      end: createDate(1, 10),
    },
    {
      id: "mock-event-3",
      userId: "mock-2",
      start: createDate(1, 12),
      end: createDate(1, 13),
    },
    {
      id: "mock-event-4",
      userId: "mock-3",
      start: createDate(2, 13),
      end: createDate(2, 15),
    },
    {
      id: "mock-event-5",
      userId: "mock-4",
      start: createDate(2, 11),
      end: createDate(2, 12),
    },
    {
      id: "mock-event-6",
      userId: "mock-2",
      start: createDate(3, 10),
      end: createDate(3, 11),
    },
    {
      id: "mock-event-7",
      userId: "mock-3",
      start: createDate(3, 14),
      end: createDate(3, 16),
    },
    // Next week
    {
      id: "mock-event-8",
      userId: "mock-4",
      start: createDate(7, 15),
      end: createDate(7, 16, 30),
    },
    {
      id: "mock-event-9",
      userId: "mock-2",
      start: createDate(8, 14),
      end: createDate(8, 15),
    },
    {
      id: "mock-event-10",
      userId: "mock-3",
      start: createDate(9, 11),
      end: createDate(9, 12, 30),
    },
    {
      id: "mock-event-11",
      userId: "mock-4",
      start: createDate(10, 13),
      end: createDate(10, 14),
    },
    // Two weeks out
    {
      id: "mock-event-12",
      userId: "mock-2",
      start: createDate(14, 9),
      end: createDate(14, 10, 30),
    },
    {
      id: "mock-event-13",
      userId: "mock-3",
      start: createDate(15, 14),
      end: createDate(15, 16),
    },
    {
      id: "mock-event-14",
      userId: "mock-4",
      start: createDate(16, 10),
      end: createDate(16, 11),
    },
  ];
}

/**
 * Pre-generated mock events using fixed dates for consistency
 * These match the original hardcoded events in App.tsx
 */
export const mockEvents: CalendarEvent[] = [
  // Week 1 - November 2025
  {
    id: "mock-2",
    userId: "mock-2",
    start: new Date(2025, 10, 12, 0, 0),
    end: new Date(2025, 10, 12, 23, 59),
    title: "Team Offsite",
    isAllDay: true,
  },
  {
    id: "mock-3",
    userId: "mock-2",
    start: new Date(2025, 10, 13, 9, 0),
    end: new Date(2025, 10, 13, 10, 0),
  },
  {
    id: "mock-4",
    userId: "mock-2",
    start: new Date(2025, 10, 13, 12, 0),
    end: new Date(2025, 10, 13, 13, 0),
  },
  {
    id: "mock-5",
    userId: "mock-3",
    start: new Date(2025, 10, 14, 13, 0),
    end: new Date(2025, 10, 14, 15, 0),
  },
  {
    id: "mock-6",
    userId: "mock-4",
    start: new Date(2025, 10, 14, 11, 0),
    end: new Date(2025, 10, 14, 12, 0),
  },
  {
    id: "mock-8",
    userId: "mock-2",
    start: new Date(2025, 10, 15, 10, 0),
    end: new Date(2025, 10, 15, 11, 0),
  },
  {
    id: "mock-9",
    userId: "mock-3",
    start: new Date(2025, 10, 15, 14, 0),
    end: new Date(2025, 10, 15, 16, 0),
  },
  // Week 2
  {
    id: "mock-10",
    userId: "mock-4",
    start: new Date(2025, 10, 18, 15, 0),
    end: new Date(2025, 10, 18, 16, 30),
  },
  {
    id: "mock-12",
    userId: "mock-2",
    start: new Date(2025, 10, 19, 14, 0),
    end: new Date(2025, 10, 19, 15, 0),
  },
  {
    id: "mock-13",
    userId: "mock-3",
    start: new Date(2025, 10, 20, 11, 0),
    end: new Date(2025, 10, 20, 12, 30),
  },
  {
    id: "mock-14",
    userId: "mock-4",
    start: new Date(2025, 10, 21, 13, 0),
    end: new Date(2025, 10, 21, 14, 0),
  },
  // Week 3
  {
    id: "mock-15",
    userId: "mock-2",
    start: new Date(2025, 10, 25, 9, 0),
    end: new Date(2025, 10, 25, 10, 30),
  },
  {
    id: "mock-16",
    userId: "mock-3",
    start: new Date(2025, 10, 26, 14, 0),
    end: new Date(2025, 10, 26, 16, 0),
  },
  {
    id: "mock-17",
    userId: "mock-4",
    start: new Date(2025, 10, 27, 10, 0),
    end: new Date(2025, 10, 27, 11, 0),
  },
  // Week 4 - December 2025
  {
    id: "mock-18",
    userId: "mock-2",
    start: new Date(2025, 11, 2, 13, 0),
    end: new Date(2025, 11, 2, 15, 0),
  },
  {
    id: "mock-19",
    userId: "mock-3",
    start: new Date(2025, 11, 3, 9, 0),
    end: new Date(2025, 11, 3, 10, 0),
  },
  {
    id: "mock-20",
    userId: "mock-4",
    start: new Date(2025, 11, 4, 14, 0),
    end: new Date(2025, 11, 4, 15, 30),
  },
  // Week 5
  {
    id: "mock-21",
    userId: "mock-2",
    start: new Date(2025, 11, 9, 11, 0),
    end: new Date(2025, 11, 9, 12, 0),
  },
  {
    id: "mock-22",
    userId: "mock-3",
    start: new Date(2025, 11, 10, 15, 0),
    end: new Date(2025, 11, 10, 16, 0),
  },
  {
    id: "mock-23",
    userId: "mock-4",
    start: new Date(2025, 11, 11, 10, 0),
    end: new Date(2025, 11, 11, 11, 30),
  },
];
