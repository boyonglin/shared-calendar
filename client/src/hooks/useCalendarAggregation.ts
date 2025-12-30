/**
 * Hook for aggregating calendar data from multiple sources
 */
import { useMemo } from "react";
import type { User, CalendarEvent } from "@shared/types";
import type { FriendWithColor } from "@/services/api/friends";

export interface UseCalendarAggregationOptions {
  /** Current authenticated user */
  currentUser: User | null;
  /** Events from user's own calendar */
  userEvents: CalendarEvent[];
  /** Friends list */
  friends: FriendWithColor[];
  /** Events from friends' calendars */
  friendEvents: CalendarEvent[];
  /** Whether friends have been initially loaded (prevents mock data flash) */
  hasFriendsInitiallyLoaded?: boolean;
  /** Mock users for demo (used when no friends and not authenticated) */
  mockUsers?: User[];
  /** Mock events for demo (used when no friends and not authenticated) */
  mockEvents?: CalendarEvent[];
}

export interface UseCalendarAggregationReturn {
  /** All users to display (current user + friends or mock users) */
  allUsers: User[];
  /** All events to display (user events + friend events or mock events) */
  allEvents: CalendarEvent[];
  /** Whether using mock data */
  isUsingMockData: boolean;
  /** Whether friends data is still loading */
  isFriendsLoading: boolean;
}

/**
 * Convert friends to User format for display
 */
function friendsToUsers(friends: FriendWithColor[]): User[] {
  return friends
    .filter((f) => f.status === "accepted" && f.friendUserId)
    .map((f) => ({
      id: f.friendUserId!,
      name: f.friendName || f.friendEmail,
      email: f.friendEmail,
      color: f.friendColor,
    }));
}

export function useCalendarAggregation({
  currentUser,
  userEvents,
  friends,
  friendEvents,
  hasFriendsInitiallyLoaded = true,
  mockUsers = [],
  mockEvents = [],
}: UseCalendarAggregationOptions): UseCalendarAggregationReturn {
  // Convert friends to User format
  const friendUsers = useMemo(() => friendsToUsers(friends), [friends]);

  // Determine if we have real friend data or should use mock data
  // Only show mock data when:
  // 1. User is not authenticated (no currentUser), OR
  // 2. User is authenticated AND friends have finished loading AND no friends exist
  const hasFriends = friendUsers.length > 0;

  // When authenticated, only show mock data after initial load completes with no friends
  const shouldShowMockData = useMemo(() => {
    if (!currentUser) {
      // Not logged in - show mock data
      return true;
    }
    if (!hasFriendsInitiallyLoaded) {
      // Still loading - don't show mock data (show loading state instead)
      return false;
    }
    // Loaded but no friends - show mock data
    return !hasFriends;
  }, [currentUser, hasFriendsInitiallyLoaded, hasFriends]);

  // Aggregate all users
  const allUsers = useMemo(() => {
    if (currentUser) {
      if (!hasFriendsInitiallyLoaded) {
        // During initial load, only show current user
        return [currentUser];
      }
      return hasFriends
        ? [currentUser, ...friendUsers]
        : [currentUser, ...mockUsers];
    }
    return hasFriends ? friendUsers : mockUsers;
  }, [
    currentUser,
    hasFriendsInitiallyLoaded,
    hasFriends,
    friendUsers,
    mockUsers,
  ]);

  // Aggregate all events
  const allEvents = useMemo(() => {
    if (currentUser && !hasFriendsInitiallyLoaded) {
      // During initial load, only show user's own events
      return userEvents;
    }
    return shouldShowMockData
      ? [...userEvents, ...mockEvents]
      : [...userEvents, ...friendEvents];
  }, [
    currentUser,
    hasFriendsInitiallyLoaded,
    shouldShowMockData,
    userEvents,
    friendEvents,
    mockEvents,
  ]);

  return {
    allUsers,
    allEvents,
    isUsingMockData: shouldShowMockData,
    // Show loading state when authenticated but haven't completed initial load
    isFriendsLoading: currentUser ? !hasFriendsInitiallyLoaded : false,
  };
}
