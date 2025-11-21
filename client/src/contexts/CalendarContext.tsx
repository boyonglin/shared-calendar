import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { CalendarEvent } from '@shared/types';
import { CalendarProvider } from '../interfaces/CalendarProvider';
import { MockCalendarProvider } from '../services/MockCalendarProvider';
import { GoogleCalendarProvider } from '../services/GoogleCalendarProvider';
import { useGoogleAuth } from './GoogleAuthContext';

interface CalendarContextType {
    events: CalendarEvent[];
    isLoading: boolean;
    refreshEvents: () => Promise<void>;
}

const CalendarContext = createContext<CalendarContextType | undefined>(undefined);

export function CalendarProviderWrapper({ children }: { children: ReactNode }) {
    const { user } = useGoogleAuth();
    const [provider, setProvider] = useState<CalendarProvider>(new MockCalendarProvider());
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Update provider when user changes
    useEffect(() => {
        if (user) {
            // Assuming user.profile.sub is the userId
            setProvider(new GoogleCalendarProvider(user.profile.sub));
        } else {
            setProvider(new MockCalendarProvider());
        }
    }, [user]);

    // Fetch events when provider changes or on mount
    useEffect(() => {
        refreshEvents();
    }, [provider]);

    const refreshEvents = async () => {
        setIsLoading(true);
        try {
            // TODO: Get actual date range from UI context or props
            // For now, fetching a broad range or relying on provider defaults
            const now = new Date();
            const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);

            const fetchedEvents = await provider.getEvents(start, end);
            setEvents(fetchedEvents);
        } catch (error) {
            console.error('Failed to fetch events:', error);
            setEvents([]);
        } finally {
            setIsLoading(false);
        }
    };

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
