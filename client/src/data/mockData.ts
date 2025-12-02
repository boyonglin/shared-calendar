/**
 * Mock data for demonstration purposes
 * Used when the user has no friends connected yet
 */
import type { User, CalendarEvent } from "@shared/types";

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
 * Mock events using fixed dates for consistency
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
