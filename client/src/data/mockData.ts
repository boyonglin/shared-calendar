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
 * Events are spread across 5 weeks: -2 weeks, -1 week, current week, +1 week, +2 weeks
 */
function generateMockEvents(): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const userIds = ["mock-2", "mock-3", "mock-4"];

  // Use week of year as seed for consistency within a session
  const today = new Date();
  const weekSeed = Math.floor(today.getTime() / (7 * 24 * 60 * 60 * 1000));
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

  // Generate events for 35 days: -14 to +14 (5 weeks: -2, -1, 0, +1, +2)
  for (let dayOffset = -14; dayOffset <= 14; dayOffset++) {
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
          id: `mock-${eventId++}`,
          userId,
          start: allDayStart,
          end: allDayEnd,
          title: template.title,
          isAllDay: true,
        });
      } else {
        events.push({
          id: `mock-${eventId++}`,
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
 * Covers 5 weeks: -2 weeks, -1 week, current week, +1 week, +2 weeks
 */
export const mockEvents: CalendarEvent[] = generateMockEvents();
