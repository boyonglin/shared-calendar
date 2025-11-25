import { useState, useEffect, useCallback } from "react";
import { CalendarView } from "./components/CalendarView";
import { UserList } from "./components/UserList";
import { InviteDialog } from "./components/InviteDialog";
import { ICloudConnectModal } from "./components/ICloudConnectModal";
import { SettingsModal } from "./components/SettingsModal";
import { FriendsManager } from "./components/FriendsManager";
import { UserProfileDropdown } from "./components/UserProfileDropdown";
import { GoogleSignInButton } from "./components/GoogleSignInButton";
import { Toaster } from "./components/ui/sonner";
import { toast } from "sonner";
import { addDays, addMinutes, startOfDay, setHours } from "date-fns";
import type { User, CalendarEvent, TimeSlot } from "./types";
import {
  GoogleAuthProvider,
  useGoogleAuth,
} from "./contexts/GoogleAuthContext";
import {
  CalendarProviderWrapper,
  useCalendar,
} from "./contexts/CalendarContext";
import { useICloudConnection } from "./hooks/useICloudConnection";
import { useOutlookConnection } from "./hooks/useOutlookConnection";
import { friendsApi, type FriendWithColor } from "./services/api/friends";

// Mock data for demonstration
const mockUsers: User[] = [
  {
    id: "2",
    name: "Sarah Johnson",
    email: "sarah@example.com",
    color: "#10b981",
  },
  {
    id: "3",
    name: "Michael Brown",
    email: "michael@example.com",
    color: "#f59e0b",
  },
  { id: "4", name: "Emma Davis", email: "emma@example.com", color: "#8b5cf6" },
];

const mockEvents: CalendarEvent[] = [
  // Week 1
  {
    id: "2",
    userId: "2",
    start: new Date(2025, 10, 12, 0, 0),
    end: new Date(2025, 10, 12, 23, 59),
    title: "Team Offsite",
    isAllDay: true,
  },
  {
    id: "3",
    userId: "2",
    start: new Date(2025, 10, 13, 9, 0),
    end: new Date(2025, 10, 13, 10, 0),
  },
  {
    id: "4",
    userId: "2",
    start: new Date(2025, 10, 13, 12, 0),
    end: new Date(2025, 10, 13, 13, 0),
  },
  {
    id: "5",
    userId: "3",
    start: new Date(2025, 10, 14, 13, 0),
    end: new Date(2025, 10, 14, 15, 0),
  },
  {
    id: "6",
    userId: "4",
    start: new Date(2025, 10, 14, 11, 0),
    end: new Date(2025, 10, 14, 12, 0),
  },
  {
    id: "8",
    userId: "2",
    start: new Date(2025, 10, 15, 10, 0),
    end: new Date(2025, 10, 15, 11, 0),
  },
  {
    id: "9",
    userId: "3",
    start: new Date(2025, 10, 15, 14, 0),
    end: new Date(2025, 10, 15, 16, 0),
  },
  // Week 2
  {
    id: "10",
    userId: "4",
    start: new Date(2025, 10, 18, 15, 0),
    end: new Date(2025, 10, 18, 16, 30),
  },
  {
    id: "12",
    userId: "2",
    start: new Date(2025, 10, 19, 14, 0),
    end: new Date(2025, 10, 19, 15, 0),
  },
  {
    id: "13",
    userId: "3",
    start: new Date(2025, 10, 20, 11, 0),
    end: new Date(2025, 10, 20, 12, 30),
  },
  {
    id: "14",
    userId: "4",
    start: new Date(2025, 10, 21, 13, 0),
    end: new Date(2025, 10, 21, 14, 0),
  },
  // Week 3
  {
    id: "15",
    userId: "2",
    start: new Date(2025, 10, 25, 9, 0),
    end: new Date(2025, 10, 25, 10, 30),
  },
  {
    id: "16",
    userId: "3",
    start: new Date(2025, 10, 26, 14, 0),
    end: new Date(2025, 10, 26, 16, 0),
  },
  {
    id: "17",
    userId: "4",
    start: new Date(2025, 10, 27, 10, 0),
    end: new Date(2025, 10, 27, 11, 0),
  },
  // Week 4
  {
    id: "18",
    userId: "2",
    start: new Date(2025, 11, 2, 13, 0),
    end: new Date(2025, 11, 2, 15, 0),
  },
  {
    id: "19",
    userId: "3",
    start: new Date(2025, 11, 3, 9, 0),
    end: new Date(2025, 11, 3, 10, 0),
  },
  {
    id: "20",
    userId: "4",
    start: new Date(2025, 11, 4, 14, 0),
    end: new Date(2025, 11, 4, 15, 30),
  },
  // Week 5
  {
    id: "21",
    userId: "2",
    start: new Date(2025, 11, 9, 11, 0),
    end: new Date(2025, 11, 9, 12, 0),
  },
  {
    id: "22",
    userId: "3",
    start: new Date(2025, 11, 10, 15, 0),
    end: new Date(2025, 11, 10, 16, 0),
  },
  {
    id: "23",
    userId: "4",
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
  const { user, signIn, signOut } = useGoogleAuth();
  const {
    events: calendarEvents,
    isLoading: isLoadingEvents,
    refreshEvents,
    createEvent,
  } = useCalendar();
  const iCloudConnection = useICloudConnection({ refreshEvents });
  const outlookConnection = useOutlookConnection({ refreshEvents });

  // Create current user from Google account
  const currentUser: User | null = user
    ? {
        id: user.profile.sub,
        name: user.profile.name,
        email: user.profile.email,
        color: "#3b82f6",
      }
    : null;

  const [selectedUsers, setSelectedUsers] = useState<string[]>([
    "1",
    "2",
    "3",
    "4",
  ]);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(
    null,
  );
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showFriendsManager, setShowFriendsManager] = useState(false);
  const [friends, setFriends] = useState<FriendWithColor[]>([]);
  const [friendEvents, setFriendEvents] = useState<CalendarEvent[]>([]);
  const [incomingRequestCount, setIncomingRequestCount] = useState(0);

  // Fetch incoming request count on mount and periodically
  const fetchIncomingRequestCount = useCallback(async () => {
    if (!user) {
      setIncomingRequestCount(0);
      return;
    }
    try {
      const response = await friendsApi.getIncomingRequests();
      setIncomingRequestCount(response.requests.length);
    } catch (err) {
      console.error("Error fetching incoming requests:", err);
    }
  }, [user]);

  useEffect(() => {
    fetchIncomingRequestCount();
  }, [fetchIncomingRequestCount]);

  // Clear friends data when user logs out
  useEffect(() => {
    if (!user) {
      setFriends([]);
      setFriendEvents([]);
      setIncomingRequestCount(0);
    }
  }, [user]);

  // Add current user to selected users when logged in
  useEffect(() => {
    if (currentUser && !selectedUsers.includes(currentUser.id)) {
      setSelectedUsers((prev) => [...prev, currentUser.id]);
    }
  }, [currentUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Check iCloud and Outlook status on mount when user is present
  useEffect(() => {
    if (user) {
      if (
        !iCloudConnection.iCloudStatus.connected &&
        iCloudConnection.iCloudStatus.email === undefined
      ) {
        iCloudConnection.checkICloudStatus();
      }
      if (
        !outlookConnection.outlookStatus.connected &&
        outlookConnection.outlookStatus.email === undefined
      ) {
        outlookConnection.checkOutlookStatus();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Fetch friends and their events when user is logged in
  const fetchFriendsAndEvents = useCallback(async () => {
    if (!user) return;

    try {
      const response = await friendsApi.getFriends();
      setFriends(response.friends);

      // Calculate time range based on weekStart (same as CalendarContext)
      let timeMin: Date;
      let timeMax: Date;

      if (weekStart) {
        timeMin = new Date(weekStart);
        timeMin.setDate(timeMin.getDate() - 14); // 2 weeks before
        timeMin.setHours(0, 0, 0, 0);

        timeMax = new Date(weekStart);
        timeMax.setDate(timeMax.getDate() + 21); // 3 weeks after
        timeMax.setHours(23, 59, 59, 999);
      } else {
        const now = new Date();
        timeMin = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        timeMax = new Date(now.getFullYear(), now.getMonth() + 2, 0);
      }

      // Fetch events for all accepted friends
      const acceptedFriends = response.friends.filter(
        (f) => f.status === "accepted" && f.friendUserId,
      );

      const allFriendEvents: CalendarEvent[] = [];
      for (const friend of acceptedFriends) {
        try {
          const events = await friendsApi.getFriendEvents(
            friend.id,
            timeMin,
            timeMax,
          );
          const transformed = events.map((e) => ({
            id: e.id,
            userId: friend.friendUserId!,
            start: new Date(
              typeof e.start === "string"
                ? e.start
                : e.start?.dateTime || e.start?.date || "",
            ),
            end: new Date(
              typeof e.end === "string"
                ? e.end
                : e.end?.dateTime || e.end?.date || "",
            ),
            title: e.title || e.summary,
            isAllDay: !!(
              (typeof e.start === "object" && e.start?.date) ||
              (typeof e.end === "object" && e.end?.date)
            ),
          }));
          allFriendEvents.push(...transformed);
        } catch (err) {
          console.error(`Error fetching events for friend ${friend.id}:`, err);
        }
      }
      setFriendEvents(allFriendEvents);
    } catch (err) {
      console.error("Error fetching friends:", err);
    }
  }, [user, weekStart]);

  useEffect(() => {
    fetchFriendsAndEvents();
  }, [fetchFriendsAndEvents]);

  // Handle friends change from FriendsManager
  const handleFriendsChange = useCallback(
    (newFriends: FriendWithColor[]) => {
      setFriends(newFriends);
      // Re-fetch events when friends change
      fetchFriendsAndEvents();
    },
    [fetchFriendsAndEvents],
  );

  // Convert Google Calendar events to our CalendarEvent format
  // Our CalendarProvider interface returns CalendarEvent[], so we can use them directly.
  const googleCalendarEvents = calendarEvents;

  // Convert friends to User format
  const friendUsers: User[] = friends
    .filter((f) => f.status === "accepted" && f.friendUserId)
    .map((f) => ({
      id: f.friendUserId!,
      name: f.friendName || f.friendEmail,
      email: f.friendEmail,
      color: f.friendColor,
    }));

  // Combine Google events with friend events (no more mock events when friends exist)
  const allEvents =
    friendUsers.length > 0
      ? [...googleCalendarEvents, ...friendEvents]
      : [...googleCalendarEvents, ...mockEvents];

  // Combine current user, friends, and mock users (mock users only if no friends)
  const allUsers = currentUser
    ? friendUsers.length > 0
      ? [currentUser, ...friendUsers]
      : [currentUser, ...mockUsers]
    : friendUsers.length > 0
      ? friendUsers
      : mockUsers;

  const handleUserToggle = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  const handleTimeSlotSelect = (slot: TimeSlot) => {
    if (!currentUser) {
      toast.warning("Please sign in to create calendar invites");
      return;
    }
    setSelectedTimeSlot(slot);
  };

  const handleSendInvite = async (
    title: string,
    description: string,
    attendees: string[],
    duration: number,
  ) => {
    if (!selectedTimeSlot || !currentUser) return;

    let start: Date;
    let end: Date;

    if (selectedTimeSlot.isAllDay) {
      // For all-day events, use the exact date without timezone conversion
      start = startOfDay(selectedTimeSlot.date);
      // End date should be the next day for Google Calendar format
      end = addDays(start, 1);
    } else {
      // For timed events, use the hour and add duration
      start = setHours(
        startOfDay(selectedTimeSlot.date),
        selectedTimeSlot.hour,
      );
      end = addMinutes(start, duration);
    }

    // Map attendee IDs to emails
    const attendeeEmails = attendees
      .map((id) => allUsers.find((u) => u.id === id)?.email)
      .filter((email): email is string => !!email);

    try {
      await createEvent({
        title,
        description,
        start,
        end,
        attendees: attendeeEmails,
        isAllDay: selectedTimeSlot.isAllDay,
      });

      setSelectedTimeSlot(null);
      toast.success("Event created successfully");
      await refreshEvents();
    } catch (error) {
      console.error("Failed to create event:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to create event: ${message}`);
    }
  };

  const handleWeekChange = (direction: "prev" | "next") => {
    const newDate = addDays(weekStart, direction === "next" ? 7 : -7);
    setWeekStart(startOfDay(newDate));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-gray-900">Calendar Sharing</h1>
              <p className="text-gray-600 mt-1">
                View and share availability with your team
              </p>
            </div>
            <div className="flex items-center gap-3">
              {!user ? (
                <GoogleSignInButton onSignIn={signIn} />
              ) : (
                currentUser && (
                  <UserProfileDropdown
                    currentUser={currentUser}
                    isLoadingEvents={isLoadingEvents}
                    iCloudConnection={iCloudConnection}
                    outlookConnection={outlookConnection}
                    onRefreshEvents={refreshEvents}
                    onSignOut={signOut}
                    onOpenSettings={() => setShowSettingsModal(true)}
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
              currentUserId={currentUser?.id || "1"}
              onUserToggle={handleUserToggle}
              onManageFriends={() => setShowFriendsManager(true)}
              isLoggedIn={!!user}
              incomingRequestCount={incomingRequestCount}
            />
          </div>

          <div className="lg:col-span-3">
            <CalendarView
              users={allUsers.filter((u) => selectedUsers.includes(u.id))}
              events={allEvents.filter((e) => selectedUsers.includes(e.userId))}
              currentUserId={currentUser?.id || "1"}
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
        users={allUsers.filter((u) => u.id !== (currentUser?.id || "1"))}
        onClose={() => setSelectedTimeSlot(null)}
        onSendInvite={handleSendInvite}
        onOpenSettings={() => setShowSettingsModal(true)}
      />

      <ICloudConnectModal
        isOpen={iCloudConnection.showICloudModal}
        onClose={() => iCloudConnection.setShowICloudModal(false)}
        onSuccess={iCloudConnection.handleICloudConnectSuccess}
      />

      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />

      <FriendsManager
        isOpen={showFriendsManager}
        onClose={() => setShowFriendsManager(false)}
        onFriendsChange={handleFriendsChange}
        onIncomingRequestsChange={setIncomingRequestCount}
      />

      <Toaster />
    </div>
  );
}

export default function App() {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const weekStart = new Date(today.setDate(diff));
    // Normalize to midnight to avoid time component issues
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  });

  return (
    <GoogleAuthProvider>
      <CalendarProviderWrapper weekStart={currentWeekStart}>
        <AppContent
          weekStart={currentWeekStart}
          setWeekStart={setCurrentWeekStart}
        />
      </CalendarProviderWrapper>
    </GoogleAuthProvider>
  );
}
