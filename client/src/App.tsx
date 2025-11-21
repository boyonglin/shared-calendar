import { useState, useEffect } from 'react';
import { CalendarView } from './components/CalendarView';
import { UserList } from './components/UserList';
import { InviteDialog } from './components/InviteDialog';
import { ICloudConnectModal } from './components/ICloudConnectModal';
import { UserProfileDropdown } from './components/UserProfileDropdown';
import { User, CalendarEvent, TimeSlot } from './types';
import { GoogleAuthProvider, useGoogleAuth } from './contexts/GoogleAuthContext';
import { CalendarProviderWrapper, useCalendar } from './contexts/CalendarContext';
import { useICloudConnection } from './hooks/useICloudConnection';

// Mock data for demonstration
const mockUsers: User[] = [
  { id: '2', name: 'Sarah Johnson', email: 'sarah@example.com', color: '#10b981' },
  { id: '3', name: 'Michael Brown', email: 'michael@example.com', color: '#f59e0b' },
  { id: '4', name: 'Emma Davis', email: 'emma@example.com', color: '#8b5cf6' },
];

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

function AppContent({
  weekStart,
  setWeekStart,
}: {
  weekStart: Date;
  setWeekStart: (date: Date) => void;
}) {
  const { user, isGoogleLoaded, signOut } = useGoogleAuth();
  const { events: calendarEvents, isLoading: isLoadingEvents, refreshEvents } = useCalendar();
  const iCloudConnection = useICloudConnection({ refreshEvents });

  // Create current user from Google account
  const currentUser: User | null = user
    ? {
        id: '1',
        name: user.profile.name,
        email: user.profile.email,
        color: '#3b82f6',
      }
    : null;

  const [selectedUsers, setSelectedUsers] = useState<string[]>(['1', '2', '3', '4']);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(null);

  // Check iCloud status on mount when user is present
  useEffect(() => {
    if (
      user &&
      !iCloudConnection.iCloudStatus.connected &&
      iCloudConnection.iCloudStatus.email === undefined
    ) {
      iCloudConnection.checkICloudStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Convert Google Calendar events to our CalendarEvent format
  // Note: CalendarContext now returns CalendarEvent[], so we might not need conversion if the provider handles it.
  // But if the provider returns raw events, we need to check.
  // Our CalendarProvider interface returns CalendarEvent[], so we can use them directly.
  const googleCalendarEvents = calendarEvents;

  // Combine Google events with mock events
  // If using MockCalendarProvider, it returns mock events.
  // If using GoogleCalendarProvider, it returns Google events.
  // So we just use googleCalendarEvents (which are now just events from the provider).
  // However, the original code combined them.
  // If we want to keep the "mock events" always visible even when logged in (as per original code logic?),
  // the original code was: const allEvents = [...googleCalendarEvents, ...mockEvents];
  // But wait, mockEvents were defined at the top level.
  // If I am logged in, I probably only want my Google events + maybe the other users' mock events?
  // The original code had mockEvents for users 2, 3, 4.
  // And googleCalendarEvents for user 1 (current user).
  // So yes, we should combine them.

  const allEvents = [...googleCalendarEvents, ...mockEvents];
  const allUsers = currentUser ? [currentUser, ...mockUsers] : mockUsers;

  const handleUserToggle = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const handleTimeSlotSelect = (slot: TimeSlot) => {
    if (!currentUser) {
      alert('Please sign in to create calendar invites');
      return;
    }
    setSelectedTimeSlot(slot);
  };

  const handleSendInvite = (title: string, description: string, attendees: string[]) => {
    console.log('Sending invite:', { title, description, attendees, timeSlot: selectedTimeSlot });
    // In a real app, this would integrate with calendar APIs
    setSelectedTimeSlot(null);
  };

  const handleWeekChange = (direction: 'prev' | 'next') => {
    const newDate = new Date(weekStart);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    setWeekStart(newDate);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-gray-900">Calendar Sharing</h1>
              <p className="text-gray-600 mt-1">View and share availability with your team</p>
            </div>
            <div className="flex items-center gap-3">
              {!user ? (
                <div id="g_id_onload_signin" className="flex justify-center min-h-[40px]">
                  {!isGoogleLoaded && (
                    <div className="flex items-center gap-2 text-gray-500">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      <span className="text-sm">Loading...</span>
                    </div>
                  )}
                </div>
              ) : (
                currentUser && (
                  <UserProfileDropdown
                    currentUser={currentUser}
                    isLoadingEvents={isLoadingEvents}
                    iCloudConnection={iCloudConnection}
                    onRefreshEvents={refreshEvents}
                    onSignOut={signOut}
                  />
                )
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <UserList
              users={allUsers}
              selectedUsers={selectedUsers}
              currentUserId={currentUser?.id || '1'}
              onUserToggle={handleUserToggle}
            />
          </div>

          <div className="lg:col-span-3">
            <CalendarView
              users={allUsers.filter((u) => selectedUsers.includes(u.id))}
              events={allEvents.filter((e) => selectedUsers.includes(e.userId))}
              currentUserId={currentUser?.id || '1'}
              weekStart={weekStart}
              onTimeSlotSelect={handleTimeSlotSelect}
              onWeekChange={handleWeekChange}
            />
          </div>
        </div>
      </div>

      <InviteDialog
        isOpen={selectedTimeSlot !== null}
        timeSlot={selectedTimeSlot}
        users={allUsers.filter((u) => u.id !== (currentUser?.id || '1'))}
        onClose={() => setSelectedTimeSlot(null)}
        onSendInvite={handleSendInvite}
      />

      <ICloudConnectModal
        isOpen={iCloudConnection.showICloudModal}
        onClose={() => iCloudConnection.setShowICloudModal(false)}
        onSuccess={iCloudConnection.handleICloudConnectSuccess}
      />
    </div>
  );
}

export default function App() {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(today.setDate(diff));
  });

  return (
    <GoogleAuthProvider>
      <CalendarProviderWrapper weekStart={currentWeekStart}>
        <AppContentWithWeek weekStart={currentWeekStart} setWeekStart={setCurrentWeekStart} />
      </CalendarProviderWrapper>
    </GoogleAuthProvider>
  );
}

function AppContentWithWeek({
  weekStart,
  setWeekStart,
}: {
  weekStart: Date;
  setWeekStart: (date: Date) => void;
}) {
  return <AppContent weekStart={weekStart} setWeekStart={setWeekStart} />;
}
