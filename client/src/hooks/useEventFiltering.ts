/**
 * Hook for filtering and deduplicating calendar events
 *
 * Handles:
 * - Deduplicating events by ID (same event can appear in multiple calendars)
 * - Filtering out friend events where current user is already an attendee
 * - Identifying mutual events (events where friends are attendees)
 */
import { useMemo } from "react";
import type { User, CalendarEvent } from "@shared/types";

export interface UseEventFilteringOptions {
  /** All events from all users */
  events: CalendarEvent[];
  /** Current user's ID */
  currentUserId: string;
  /** All users (current + friends) */
  users: User[];
}

export interface UseEventFilteringReturn {
  /** Events after filtering and deduplication */
  filteredEvents: CalendarEvent[];
  /** Set of event IDs that are mutual (current user's events with friend attendees) */
  mutualEventIds: Set<string>;
}

/**
 * Extract friend emails from users list (excluding current user)
 */
function getFriendEmails(users: User[], currentUserId: string): Set<string> {
  return new Set(
    users
      .filter((u) => u.id !== currentUserId)
      .map((u) => u.email?.toLowerCase())
      .filter((email): email is string => !!email),
  );
}

/**
 * Check if an event has any friend as an attendee
 */
function hasFriendAttendee(
  event: CalendarEvent,
  friendEmails: Set<string>,
): boolean {
  if (!event.attendees) return false;
  return event.attendees.some((email) => friendEmails.has(email.toLowerCase()));
}

/**
 * Check if current user is an attendee of an event
 */
function isCurrentUserAttendee(
  event: CalendarEvent,
  currentUserEmail: string | undefined,
): boolean {
  if (!event.attendees || !currentUserEmail) return false;
  return event.attendees.some(
    (email) => email.toLowerCase() === currentUserEmail,
  );
}

/**
 * Hook for filtering and deduplicating calendar events
 */
export function useEventFiltering({
  events,
  currentUserId,
  users,
}: UseEventFilteringOptions): UseEventFilteringReturn {
  // Get current user's email for attendee matching
  const currentUserEmail = useMemo(() => {
    const currentUser = users.find((u) => u.id === currentUserId);
    return currentUser?.email?.toLowerCase();
  }, [users, currentUserId]);

  return useMemo(() => {
    const mutualIds = new Set<string>();
    const seenEventIds = new Set<string>();
    const friendEmails = getFriendEmails(users, currentUserId);

    // First pass: identify mutual events and track current user's event IDs
    // - For current user's events: track IDs for deduplication, mark as mutual if friend is attendee
    // - For friend's events: mark as mutual if current user is attendee
    for (const event of events) {
      if (event.userId === currentUserId) {
        seenEventIds.add(event.id);
        // Event is mutual if any friend is an attendee
        if (hasFriendAttendee(event, friendEmails)) {
          mutualIds.add(event.id);
        }
      } else {
        // For friend's events, check if current user is an attendee (mutual event)
        if (isCurrentUserAttendee(event, currentUserEmail)) {
          mutualIds.add(event.id);
        }
      }
    }

    // Second pass: filter events
    const filteredEvents = events.filter((event) => {
      // Always keep current user's events
      if (event.userId === currentUserId) {
        return true;
      }

      // Skip friend events if we already have this event from current user
      // (handles shared events that appear in multiple calendars)
      if (seenEventIds.has(event.id)) {
        return false;
      }

      // Skip friend events where current user is an attendee
      // (they'll see this event in their own calendar)
      if (isCurrentUserAttendee(event, currentUserEmail)) {
        return false;
      }

      // Track this event ID to avoid duplicates among multiple friends
      seenEventIds.add(event.id);
      return true;
    });

    return { filteredEvents, mutualEventIds: mutualIds };
  }, [events, currentUserId, currentUserEmail, users]);
}
