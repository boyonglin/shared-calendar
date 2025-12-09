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
  /** Mock users for demo (used when no friends) */
  mockUsers?: User[];
  /** Mock events for demo (used when no friends) */
  mockEvents?: CalendarEvent[];
}

export interface UseCalendarAggregationReturn {
  /** All users to display (current user + friends or mock users) */
  allUsers: User[];
  /** All events to display (user events + friend events or mock events) */
  allEvents: CalendarEvent[];
  /** Whether using mock data */
  isUsingMockData: boolean;
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
  mockUsers = [],
  mockEvents = [],
}: UseCalendarAggregationOptions): UseCalendarAggregationReturn {
  // Convert friends to User format
  const friendUsers = useMemo(() => friendsToUsers(friends), [friends]);

  // Determine if we have real friend data or should use mock data
  const hasFriends = friendUsers.length > 0;

  // Aggregate all users
  const allUsers = useMemo(() => {
    if (currentUser) {
      return hasFriends
        ? [currentUser, ...friendUsers]
        : [currentUser, ...mockUsers];
    }
    return hasFriends ? friendUsers : mockUsers;
  }, [currentUser, hasFriends, friendUsers, mockUsers]);

  // Aggregate all events
  const allEvents = useMemo(() => {
    return hasFriends
      ? [...userEvents, ...friendEvents]
      : [...userEvents, ...mockEvents];
  }, [hasFriends, userEvents, friendEvents, mockEvents]);

  return {
    allUsers,
    allEvents,
    isUsingMockData: !hasFriends,
  };
}
