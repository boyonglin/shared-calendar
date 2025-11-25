import type { ReactNode } from "react";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import type { CalendarEvent } from "@shared/types";
import type { CalendarProvider } from "@/interfaces/CalendarProvider";
import { MockCalendarProvider } from "@/services/MockCalendarProvider";
import { UnifiedCalendarProvider } from "@/services/UnifiedCalendarProvider";
import { useGoogleAuth } from "./GoogleAuthContext";

export interface CalendarContextType {
  events: CalendarEvent[];
  isLoading: boolean;
  refreshEvents: () => Promise<void>;
  createEvent: (event: {
    title: string;
    description?: string;
    start: Date;
    end: Date;
    attendees?: string[];
    isAllDay?: boolean;
  }) => Promise<void>;
}

export const CalendarContext = createContext<CalendarContextType | undefined>(
  undefined,
);

export function CalendarProviderWrapper({
  children,
  weekStart,
}: {
  children: ReactNode;
  weekStart?: Date;
}) {
  const { user } = useGoogleAuth();
  const [provider, setProvider] = useState<CalendarProvider>(
    new MockCalendarProvider(),
  );
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Update provider when user changes
  useEffect(() => {
    if (user) {
      // Use UnifiedCalendarProvider which fetches from all connected accounts
      // The userId from Google will be used to identify the primary user
      setProvider(new UnifiedCalendarProvider(user.profile.sub));
    } else {
      setProvider(new MockCalendarProvider());
    }
  }, [user]);

  const createEvent = async (eventData: {
    title: string;
    description?: string;
    start: Date;
    end: Date;
    attendees?: string[];
    isAllDay?: boolean;
  }) => {
    if (provider.createEvent) {
      try {
        const newEvent = await provider.createEvent(eventData);
        setEvents((prev) => [...prev, newEvent]);
      } catch (error) {
        console.error("Failed to create event:", error);
        throw error;
      }
    } else {
      throw new Error("Provider does not support creating events");
    }
  };

  const refreshEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      // Calculate date range based on weekStart prop or use default range
      let start: Date;
      let end: Date;

      if (weekStart) {
        // Fetch events for 5 weeks total: current week (w0), 2 weeks before (w-1, w-2?), and 2 weeks after
        start = new Date(weekStart);
        start.setDate(start.getDate() - 14); // 2 weeks before
        start.setHours(0, 0, 0, 0); // Normalize to midnight

        end = new Date(weekStart);
        end.setDate(end.getDate() + 21); // 3 weeks after (covers current week + 2 more)
        end.setHours(23, 59, 59, 999); // End of day
      } else {
        // Fallback to broad range if no weekStart provided
        const now = new Date();
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        start.setHours(0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
        end.setHours(23, 59, 59, 999);
      }

      const fetchedEvents = await provider.getEvents(start, end);

      setEvents((prevEvents) => {
        // Cache/Merge logic:
        // 1. Define the fetch range
        const fetchStart = start.getTime();
        const fetchEnd = end.getTime();

        // 2. Keep events that are strictly outside the fetched range
        // (Remove events that overlap with the new fetch range, as the new fetch is authoritative)
        const nonOverlappingEvents = prevEvents.filter((event) => {
          const eventStart = new Date(event.start).getTime();
          const eventEnd = new Date(event.end).getTime();
          // Keep if event ends before fetch starts OR event starts after fetch ends
          return eventEnd <= fetchStart || eventStart >= fetchEnd;
        });

        // 3. Merge with new events and deduplicate by ID
        const allEvents = [...nonOverlappingEvents, ...fetchedEvents];
        const uniqueEventsMap = new Map(allEvents.map((e) => [e.id, e]));
        return Array.from(uniqueEventsMap.values());
      });
    } catch (error) {
      console.error("Error fetching calendar events:", error);
      // On error, keep existing events (cache) rather than clearing
    } finally {
      setIsLoading(false);
    }
  }, [provider, weekStart]);

  // Clear events when provider changes to avoid mixing events from different accounts
  useEffect(() => {
    setEvents([]);
  }, [provider]);

  // Refresh events when refreshEvents callback changes (which happens when provider or weekStart changes)
  useEffect(() => {
    refreshEvents();
  }, [refreshEvents]);

  // Auto-refresh events every 60 seconds, but only when window is focused/visible
  useEffect(() => {
    let intervalId: number | null = null;

    const startInterval = () => {
      if (intervalId === null) {
        intervalId = window.setInterval(() => {
          refreshEvents();
        }, 60000);
      }
    };

    const clearIntervalIfExists = () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshEvents();
        startInterval();
      } else {
        clearIntervalIfExists();
      }
    };

    if (document.visibilityState === "visible") {
      startInterval();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearIntervalIfExists();
    };
  }, [refreshEvents]);

  return (
    <CalendarContext.Provider
      value={{ events, isLoading, refreshEvents, createEvent }}
    >
      {children}
    </CalendarContext.Provider>
  );
}

export function useCalendar() {
  const context = useContext(CalendarContext);
  if (context === undefined) {
    throw new Error(
      "useCalendar must be used within a CalendarProviderWrapper",
    );
  }
  return context;
}
