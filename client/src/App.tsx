import { useState, useEffect } from "react";
import { Analytics } from "@vercel/analytics/react";
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
import { Button } from "./components/ui/button";
import { Moon, Sun } from "lucide-react";
import {
  addDays,
  addMinutes,
  startOfDay,
  startOfWeek,
  setHours,
} from "date-fns";
import type { User, TimeSlot } from "./types";
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
import { useFriends } from "./hooks/useFriends";
import { useCalendarAggregation } from "./hooks/useCalendarAggregation";
import { useAppState } from "./hooks/useAppState";
import { mockUsers, mockEvents } from "./data/mockData";

function AppContent({
  weekStart,
  setWeekStart,
  isDarkMode,
  toggleDarkMode,
}: {
  weekStart: Date;
  setWeekStart: (date: Date) => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}) {
  const { user, signIn, signOut, revokeAccount, isRevoking } = useGoogleAuth();
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

  // Use extracted hooks for friends and calendar aggregation
  const {
    friends,
    friendEvents,
    incomingRequestCount,
    setIncomingRequestCount,
    refetch: refetchFriends,
  } = useFriends({ isAuthenticated: !!user, weekStart });

  const { allUsers, allEvents } = useCalendarAggregation({
    currentUser,
    userEvents: calendarEvents,
    friends,
    friendEvents,
    mockUsers,
    mockEvents,
  });

  // Use app state hook for UI state management
  const {
    selectedUsers,
    toggleUser: handleUserToggle,
    modals,
    openModal,
    closeModal,
  } = useAppState({ currentUser });

  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(
    null,
  );

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

  const handleWeekChange = (direction: "prev" | "next" | "today") => {
    if (direction === "today") {
      setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
    } else {
      const newDate = addDays(weekStart, direction === "next" ? 7 : -7);
      setWeekStart(startOfDay(newDate));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="border-b bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-gray-900 dark:text-white">
                Calendar Sharing
              </h1>
              <p className="mt-1 text-gray-600 dark:text-gray-400">
                View and share availability with your team
              </p>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
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
                    onOpenSettings={() => openModal("settings")}
                  />
                )
              )}
              <Button
                variant="outline"
                size="icon"
                onClick={toggleDarkMode}
                aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
              >
                {isDarkMode ? (
                  <Sun className="w-4 h-4" />
                ) : (
                  <Moon className="w-4 h-4 text-gray-900" />
                )}
              </Button>
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
              onManageFriends={() => openModal("friends")}
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
        onOpenSettings={() => openModal("settings")}
      />

      <ICloudConnectModal
        isOpen={iCloudConnection.showICloudModal}
        onClose={() => iCloudConnection.setShowICloudModal(false)}
        onSuccess={iCloudConnection.handleICloudConnectSuccess}
      />

      <SettingsModal
        key={modals.settings ? "open" : "closed"}
        isOpen={modals.settings}
        onClose={() => closeModal("settings")}
        isRevoking={isRevoking}
        onRevokeAccount={revokeAccount}
      />

      <FriendsManager
        isOpen={modals.friends}
        onClose={() => closeModal("friends")}
        onFriendsChange={refetchFriends}
        onIncomingRequestsChange={setIncomingRequestCount}
        initialTab={incomingRequestCount > 0 ? "requests" : "friends"}
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

  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Check localStorage or system preference
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("darkMode");
      if (saved !== null) {
        return JSON.parse(saved);
      }
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });

  // Update document class for dark mode
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("darkMode", JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode((prev: boolean) => !prev);
  };

  return (
    <GoogleAuthProvider>
      <CalendarProviderWrapper weekStart={currentWeekStart}>
        <AppContent
          weekStart={currentWeekStart}
          setWeekStart={setCurrentWeekStart}
          isDarkMode={isDarkMode}
          toggleDarkMode={toggleDarkMode}
        />
        <Analytics />
      </CalendarProviderWrapper>
    </GoogleAuthProvider>
  );
}
