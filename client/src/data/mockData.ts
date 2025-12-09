/**
 * Mock data for demonstration purposes
 * Used when the user has no friends connected yet
 */
import type { User, CalendarEvent } from "@shared/types";
import { ONE_WEEK_MS } from "@shared/core/constants/index";

// =============================================================================
// Mock User IDs - Constants for consistent references
// =============================================================================

/**
 * Mock user ID constants for demonstration users
 * Use these constants instead of hardcoded strings for consistency
 */
export const MOCK_USER_IDS = {
  SARAH: "mock-2",
  MICHAEL: "mock-3",
  EMMA: "mock-4",
} as const;

export type MockUserId = (typeof MOCK_USER_IDS)[keyof typeof MOCK_USER_IDS];

/**
 * Mock event ID prefix
 */
export const MOCK_EVENT_ID_PREFIX = "mock-" as const;

// =============================================================================
// Mock Users
// =============================================================================

/**
 * Mock users for demonstration
 */
export const mockUsers: User[] = [
  {
    id: MOCK_USER_IDS.SARAH,
    name: "Sarah Johnson",
    email: "sarah@example.com",
    color: "#10b981",
  },
  {
    id: MOCK_USER_IDS.MICHAEL,
    name: "Michael Brown",
    email: "michael@example.com",
    color: "#f59e0b",
  },
  {
    id: MOCK_USER_IDS.EMMA,
    name: "Emma Davis",
    email: "emma@example.com",
    color: "#8b5cf6",
  },
];

/**
 * Helper function to get a date relative to today
 * @param dayOffset - Number of days from today (negative for past, positive for future)
 * @param hour - Hour of the day (0-23)
 * @param minute - Minute (0-59)
 */
function getRelativeDate(
  dayOffset: number,
  hour: number,
  minute: number = 0,
): Date {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date;
}

/**
 * Seeded random number generator for consistent mock data
 * Uses the current week number as seed so events stay consistent within a week
 */
function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

/**
 * Generate mock events dynamically based on current date
 * Events are limited to the current week only (Sunday to Saturday)
 */
function generateMockEvents(): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const userIds = mockUsers.map((user) => user.id);

  // Use week of year as seed for consistency within a session
  const today = new Date();
  const weekSeed = Math.floor(today.getTime() / ONE_WEEK_MS);

  // Calculate current week boundaries (Sunday to Saturday)
  const currentDayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
  const weekStartOffset = -currentDayOfWeek; // Days to go back to Sunday
  const weekEndOffset = 6 - currentDayOfWeek; // Days to go forward to Saturday
  const random = seededRandom(weekSeed);

  // Event templates with titles and durations
  const eventTemplates = [
    { title: "Team Meeting", duration: 60 },
    { title: "Project Review", duration: 90 },
    { title: "Client Call", duration: 30 },
    { title: "Design Session", duration: 120 },
    { title: "Standup", duration: 15 },
    { title: "Workshop", duration: 180 },
    { title: "1:1 Meeting", duration: 30 },
    { title: "Planning", duration: 60 },
    { title: "Code Review", duration: 45 },
    { title: "Lunch Meeting", duration: 60 },
  ];

  // Common start hours for meetings (9 AM to 5 PM)
  const startHours = [9, 10, 11, 13, 14, 15, 16];

  let eventId = 1;

  // Generate events only for current week (Sunday to Saturday)
  for (
    let dayOffset = weekStartOffset;
    dayOffset <= weekEndOffset;
    dayOffset++
  ) {
    const checkDate = new Date();
    checkDate.setDate(checkDate.getDate() + dayOffset);
    const dayOfWeek = checkDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Fewer events on weekends (0-2), more on weekdays (1-3)
    const eventsPerDay = isWeekend
      ? Math.floor(random() * 3) // 0-2 events on weekends
      : Math.floor(random() * 3) + 1; // 1-3 events on weekdays

    if (eventsPerDay === 0) continue;

    for (let i = 0; i < eventsPerDay; i++) {
      // Pick random user
      const userId = userIds[Math.floor(random() * userIds.length)];

      // Pick random template
      const template =
        eventTemplates[Math.floor(random() * eventTemplates.length)];

      // Pick random start hour
      const startHour = startHours[Math.floor(random() * startHours.length)];
      const startMinute = random() > 0.5 ? 30 : 0;

      const start = getRelativeDate(dayOffset, startHour, startMinute);
      const end = new Date(start.getTime() + template.duration * 60 * 1000);

      // Occasionally create all-day events
      const isAllDay = random() < 0.1;

      if (isAllDay) {
        const allDayStart = getRelativeDate(dayOffset, 0, 0);
        const allDayEnd = getRelativeDate(dayOffset, 23, 59);
        events.push({
          id: `${MOCK_EVENT_ID_PREFIX}${eventId++}`,
          userId,
          start: allDayStart,
          end: allDayEnd,
          title: template.title,
          isAllDay: true,
        });
      } else {
        events.push({
          id: `${MOCK_EVENT_ID_PREFIX}${eventId++}`,
          userId,
          start,
          end,
          title: random() > 0.3 ? template.title : undefined, // Some events without title
        });
      }
    }
  }

  return events;
}

/**
 * Mock events generated dynamically relative to today
 * Events are limited to the current week only (Sunday to Saturday)
 */
export const mockEvents: CalendarEvent[] = generateMockEvents();
