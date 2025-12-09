import type { ReactNode } from "react";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import type { CalendarEvent } from "@shared/types";
import type { CalendarProvider } from "@/interfaces/CalendarProvider";
import { MockCalendarProvider } from "@/services/MockCalendarProvider";
import { UnifiedCalendarProvider } from "@/services/UnifiedCalendarProvider";
import { useGoogleAuth } from "./GoogleAuthContext";
import { calculateEventTimeRange } from "@/utils/calendar";

const AUTO_REFRESH_INTERVAL_MS = 30 * 1000;

// Generate a temporary ID for optimistic updates
const generateTempEventId = () =>
  `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export interface CalendarContextType {
  events: CalendarEvent[];
  isLoading: boolean;
  loadingProviders: Set<string>;
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
  const [loadingProviders, setLoadingProviders] = useState<Set<string>>(
    new Set(),
  );

  // Track the current stream abort controller
  const streamAbortRef = useRef<AbortController | null>(null);

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
      // Create optimistic event with temporary ID
      const tempId = generateTempEventId();
      const optimisticEvent: CalendarEvent = {
        id: tempId,
        userId: user?.profile.sub || "unknown",
        title: eventData.title,
        start: eventData.start,
        end: eventData.end,
        isAllDay: eventData.isAllDay,
      };

      // Optimistic update: add event immediately
      setEvents((prev) => [...prev, optimisticEvent]);

      try {
        const newEvent = await provider.createEvent(eventData);
        // Replace optimistic event with real one from server
        setEvents((prev) => prev.map((e) => (e.id === tempId ? newEvent : e)));
      } catch (error) {
        // Rollback optimistic update on error
        setEvents((prev) => prev.filter((e) => e.id !== tempId));
        console.error("Failed to create event:", error);
        throw error;
      }
    } else {
      throw new Error("Provider does not support creating events");
    }
  };

  const refreshEvents = useCallback(async () => {
    // Abort any existing stream
    if (streamAbortRef.current) {
      streamAbortRef.current.abort();
      streamAbortRef.current = null;
    }

    setIsLoading(true);
    setLoadingProviders(new Set(["google", "icloud", "outlook"])); // Start with all providers loading

    // Calculate date range using shared utility
    const { timeMin, timeMax } = calculateEventTimeRange(weekStart);
    const fetchStart = timeMin.getTime();
    const fetchEnd = timeMax.getTime();

    // Check if provider supports streaming (UnifiedCalendarProvider)
    if (provider instanceof UnifiedCalendarProvider) {
      // Use streaming for progressive updates
      const receivedProviders = new Set<string>();

      streamAbortRef.current = provider.streamEvents(
        timeMin,
        timeMax,
        (newEvents: CalendarEvent[], providerName: string) => {
          receivedProviders.add(providerName);

          // Update loading providers
          setLoadingProviders((prev) => {
            const next = new Set(prev);
            next.delete(providerName);
            return next;
          });

          // Merge new events with existing ones
          setEvents((prevEvents) => {
            // Keep events outside the fetch range
            const nonOverlappingEvents = prevEvents.filter((event) => {
              const eventStart = new Date(event.start).getTime();
              const eventEnd = new Date(event.end).getTime();
              return eventEnd <= fetchStart || eventStart >= fetchEnd;
            });

            // Keep events from already received providers within the fetch range
            const existingInRangeEvents = prevEvents.filter((event) => {
              const eventStart = new Date(event.start).getTime();
              const eventEnd = new Date(event.end).getTime();
              return eventStart < fetchEnd && eventEnd > fetchStart;
            });

            // Merge with new events and deduplicate by ID
            const allEvents = [
              ...nonOverlappingEvents,
              ...existingInRangeEvents,
              ...newEvents,
            ];

            const uniqueEventsMap = new Map(allEvents.map((e) => [e.id, e]));
            return Array.from(uniqueEventsMap.values());
          });
        },
        () => {
          // Stream complete
          setIsLoading(false);
          setLoadingProviders(new Set());
          streamAbortRef.current = null;
        },
        (error: Error) => {
          console.error("Error streaming calendar events:", error);
          setIsLoading(false);
          setLoadingProviders(new Set());
          streamAbortRef.current = null;
          // On error, keep existing events (cache) rather than clearing
        },
      );
    } else {
      // Fallback to non-streaming for MockCalendarProvider
      try {
        const fetchedEvents = await provider.getEvents(timeMin, timeMax);

        setEvents((prevEvents) => {
          // Keep events outside the fetch range
          const nonOverlappingEvents = prevEvents.filter((event) => {
            const eventStart = new Date(event.start).getTime();
            const eventEnd = new Date(event.end).getTime();
            return eventEnd <= fetchStart || eventStart >= fetchEnd;
          });

          // Merge with new events and deduplicate by ID
          const allEvents = [...nonOverlappingEvents, ...fetchedEvents];
          const uniqueEventsMap = new Map(allEvents.map((e) => [e.id, e]));
          return Array.from(uniqueEventsMap.values());
        });
      } catch (error) {
        console.error("Error fetching calendar events:", error);
        // On error, keep existing events (cache) rather than clearing
      } finally {
        setIsLoading(false);
        setLoadingProviders(new Set());
      }
    }
  }, [provider, weekStart]);

  // Clear events when provider changes to avoid mixing events from different accounts
  useEffect(() => {
    setEvents([]);
  }, [provider]);

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      if (streamAbortRef.current) {
        streamAbortRef.current.abort();
      }
    };
  }, []);

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
        }, AUTO_REFRESH_INTERVAL_MS);
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
      value={{
        events,
        isLoading,
        loadingProviders,
        refreshEvents,
        createEvent,
      }}
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
