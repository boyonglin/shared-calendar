import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { CalendarEvent } from '@shared/types';
import { CalendarProvider } from '../interfaces/CalendarProvider';
import { MockCalendarProvider } from '../services/MockCalendarProvider';
import { UnifiedCalendarProvider } from '../services/UnifiedCalendarProvider';
import { useGoogleAuth } from './GoogleAuthContext';

interface CalendarContextType {
  events: CalendarEvent[];
  isLoading: boolean;
  refreshEvents: () => Promise<void>;
}

const CalendarContext = createContext<CalendarContextType | undefined>(undefined);

export function CalendarProviderWrapper({
  children,
  weekStart,
}: {
  children: ReactNode;
  weekStart?: Date;
}) {
  const { user } = useGoogleAuth();
  const [provider, setProvider] = useState<CalendarProvider>(new MockCalendarProvider());
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

  const refreshEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      // Calculate date range based on weekStart prop or use default range
      let start: Date;
      let end: Date;

      if (weekStart) {
        // Fetch events for the current week + 2 weeks before and 2 weeks after for better UX
        start = new Date(weekStart);
        start.setDate(start.getDate() - 14); // 2 weeks before

        end = new Date(weekStart);
        end.setDate(end.getDate() + 28); // 4 weeks after (current week + 3 more)
      } else {
        // Fallback to broad range if no weekStart provided
        const now = new Date();
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
      }

      const fetchedEvents = await provider.getEvents(start, end);
      setEvents(fetchedEvents);
    } catch (error) {
      console.error('Failed to fetch events:', error);
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, [provider, weekStart]);

  // Refresh events when provider or weekStart changes
  useEffect(() => {
    refreshEvents();
  }, [refreshEvents]);

  return (
    <CalendarContext.Provider value={{ events, isLoading, refreshEvents }}>
      {children}
    </CalendarContext.Provider>
  );
}

export function useCalendar() {
  const context = useContext(CalendarContext);
  if (context === undefined) {
    throw new Error('useCalendar must be used within a CalendarProviderWrapper');
  }
  return context;
}
