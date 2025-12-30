/**
 * Hook for managing friend connections and their calendar events
 */
import { useState, useEffect, useCallback } from "react";
import { friendsApi, type FriendWithColor } from "@/services/api/friends";
import type { CalendarEvent } from "@shared/types";
import { calculateEventTimeRange } from "@/utils/calendar";
import { transformRawEvent } from "@/utils/eventTransform";

export interface UseFriendsReturn {
  friends: FriendWithColor[];
  friendEvents: CalendarEvent[];
  incomingRequestCount: number;
  /** Setter for incoming request count (for FriendsManager updates) */
  setIncomingRequestCount: React.Dispatch<React.SetStateAction<number>>;
  /** Whether friends data is currently being fetched */
  isLoading: boolean;
  /** Whether the initial load has completed (prevents showing mock data during first fetch) */
  hasInitiallyLoaded: boolean;
  error: string | null;
  /** Alias for refreshFriends - used by FriendsManager */
  refetch: () => Promise<void>;
  refreshFriends: () => Promise<void>;
  refreshIncomingRequests: () => Promise<void>;
  syncPendingConnections: () => Promise<void>;
}

interface UseFriendsOptions {
  /** Whether the user is authenticated */
  isAuthenticated: boolean;
  /** Current week start for fetching events */
  weekStart: Date;
  /** Whether to automatically sync pending connections */
  autoSyncPending?: boolean;
}

export function useFriends({
  isAuthenticated,
  weekStart,
  autoSyncPending = true,
}: UseFriendsOptions): UseFriendsReturn {
  const [friends, setFriends] = useState<FriendWithColor[]>([]);
  const [friendEvents, setFriendEvents] = useState<CalendarEvent[]>([]);
  const [incomingRequestCount, setIncomingRequestCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  // Track whether we've completed the initial load - prevents showing mock data
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Sync pending friend connections (check if pending friends have signed up)
   */
  const syncPendingConnections = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      await friendsApi.syncPendingConnections();
    } catch (err) {
      console.error("Error syncing pending connections:", err);
      // Don't set error state - this is a background operation
    }
  }, [isAuthenticated]);

  /**
   * Fetch incoming friend requests count
   */
  const refreshIncomingRequests = useCallback(async () => {
    if (!isAuthenticated) {
      setIncomingRequestCount(0);
      return;
    }

    try {
      const response = await friendsApi.getIncomingRequests();
      setIncomingRequestCount(response.requests.length);
    } catch (err) {
      console.error("Error fetching incoming requests:", err);
    }
  }, [isAuthenticated]);

  /**
   * Fetch friends list and their calendar events with progressive loading
   * Phase 1: Fetch friends list (fast) - shows friend names immediately
   * Phase 2: Fetch friend events in batches (progressive) - reduces congestion
   */
  const refreshFriends = useCallback(async () => {
    if (!isAuthenticated) {
      setFriends([]);
      setFriendEvents([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    // Clear existing friend events before fetching new ones
    setFriendEvents([]);

    try {
      // Phase 1: Fetch friends list first (fast operation)
      // Don't wait for sync - do it in background to show friends faster
      const syncPromise = autoSyncPending
        ? syncPendingConnections()
        : Promise.resolve();

      // Fetch friends list immediately
      const response = await friendsApi.getFriends();
      setFriends(response.friends);
      // Mark initial load complete after friends list arrives
      // This allows UI to show friends immediately
      setHasInitiallyLoaded(true);

      // Calculate time range for events
      const { timeMin, timeMax } = calculateEventTimeRange(weekStart);

      // Fetch events for all accepted friends
      const acceptedFriends = response.friends.filter(
        (f) => f.status === "accepted" && f.friendUserId,
      );

      // Phase 2: Progressive event loading
      // Fetch events in small batches to reduce network congestion
      const BATCH_SIZE = 3; // Fetch 3 friends' events at a time
      const batches: (typeof acceptedFriends)[] = [];

      for (let i = 0; i < acceptedFriends.length; i += BATCH_SIZE) {
        batches.push(acceptedFriends.slice(i, i + BATCH_SIZE));
      }

      // Process batches and update events progressively
      for (const batch of batches) {
        const eventPromises = batch.map((friend) =>
          friendsApi
            .getFriendEvents(friend.id, timeMin, timeMax)
            .then((events) =>
              events.map((e) =>
                transformRawEvent(e, {
                  userId: friend.friendUserId!,
                  friendConnectionId: friend.id,
                }),
              ),
            )
            .catch((err) => {
              // Silently handle 404 errors (friend was deleted or connection removed)
              // Only log non-404 errors as they indicate actual issues
              if (err instanceof Error && !err.message.includes("Not found")) {
                console.error(
                  "Error fetching events for friend %s:",
                  friend.id,
                  err,
                );
              }
              return [];
            }),
        );

        const batchResults = await Promise.all(eventPromises);
        const batchEvents = batchResults.flat();

        // Progressively add events as each batch completes
        setFriendEvents((prev) => [...prev, ...batchEvents]);
      }

      // Wait for sync to complete (if it's still running)
      await syncPromise;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch friends";
      setError(message);
      console.error("Error fetching friends:", err);
      // Still mark as loaded even on error so UI doesn't stay in loading state forever
      setHasInitiallyLoaded(true);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, weekStart, autoSyncPending, syncPendingConnections]);

  // Clear data when user logs out
  useEffect(() => {
    if (!isAuthenticated) {
      setFriends([]);
      setFriendEvents([]);
      setIncomingRequestCount(0);
      setError(null);
      // Reset initial load state when logged out so next login shows loading state
      setHasInitiallyLoaded(false);
    }
  }, [isAuthenticated]);

  // Fetch friends and requests when authenticated or week changes
  useEffect(() => {
    if (isAuthenticated) {
      refreshFriends();
      refreshIncomingRequests();
    }
  }, [isAuthenticated, refreshFriends, refreshIncomingRequests]);

  return {
    friends,
    friendEvents,
    incomingRequestCount,
    setIncomingRequestCount,
    isLoading,
    hasInitiallyLoaded,
    error,
    refetch: refreshFriends,
    refreshFriends,
    refreshIncomingRequests,
    syncPendingConnections,
  };
}
