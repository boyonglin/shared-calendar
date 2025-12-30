/**
 * Hook for managing friend connections and their calendar events
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { friendsApi, type FriendWithColor } from "@/services/api/friends";
import type { CalendarEvent } from "@shared/types";
import { calculateEventTimeRange } from "@/utils/calendar";
import { transformRawEvent } from "@/utils/eventTransform";

/**
 * Number of friends to fetch events for in each batch.
 * A small batch size (3) balances reducing network requests while keeping
 * individual requests fast and avoiding server overload.
 */
const BATCH_SIZE = 3;

export interface UseFriendsReturn {
  friends: FriendWithColor[];
  friendEvents: CalendarEvent[];
  incomingRequestCount: number;
  /** Setter for incoming request count (for FriendsManager updates) */
  setIncomingRequestCount: React.Dispatch<React.SetStateAction<number>>;
  /** Whether friends data is currently being fetched */
  isLoading: boolean;
  /** Whether the initial load has completed (allows showing appropriate data or loading state) */
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
  // Track the current refresh operation to prevent race conditions
  const refreshIdRef = useRef(0);
  // Ref to track initial load state without causing callback recreation
  const hasInitiallyLoadedRef = useRef(false);

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

    // Increment refresh ID to invalidate any in-flight requests
    const currentRefreshId = ++refreshIdRef.current;

    setIsLoading(true);
    setError(null);
    // Track if this is the first load (don't clear events on subsequent refreshes to avoid flash)
    const isInitialLoad = !hasInitiallyLoadedRef.current;

    try {
      // Phase 1: Fetch friends list first (fast operation)
      // Don't wait for sync - do it in background to show friends faster
      const syncPromise = autoSyncPending
        ? syncPendingConnections()
        : Promise.resolve();

      // Fetch friends list immediately
      const response = await friendsApi.getFriends();

      // Check if this request is still valid (no newer refresh started)
      if (refreshIdRef.current !== currentRefreshId) return;

      setFriends(response.friends);
      // Mark initial load complete after friends list arrives
      // This allows UI to show friends immediately
      hasInitiallyLoadedRef.current = true;
      setHasInitiallyLoaded(true);

      // Calculate time range for events
      const { timeMin, timeMax } = calculateEventTimeRange(weekStart);

      // Fetch events for all accepted friends
      const acceptedFriends = response.friends.filter(
        (f) => f.status === "accepted" && f.friendUserId,
      );

      // Clear events only after friends list is loaded (prevents flash during refresh)
      if (isInitialLoad) {
        setFriendEvents([]);
      }

      // Phase 2: Progressive event loading
      // Fetch events in small batches to reduce network congestion
      const batches: (typeof acceptedFriends)[] = [];

      for (let i = 0; i < acceptedFriends.length; i += BATCH_SIZE) {
        batches.push(acceptedFriends.slice(i, i + BATCH_SIZE));
      }

      // Process batches and update events progressively
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        // Check if this request is still valid before processing each batch
        if (refreshIdRef.current !== currentRefreshId) return;

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
                  `Error fetching events for friend ${friend.id}:`,
                  err,
                );
              }
              return [];
            }),
        );

        const batchResults = await Promise.all(eventPromises);
        const batchEvents = batchResults.flat();

        // Check again after async operation
        if (refreshIdRef.current !== currentRefreshId) return;

        // Progressively add events as each batch completes
        // For non-initial loads, replace all events on first batch to clear stale data
        if (!isInitialLoad && batchIndex === 0) {
          setFriendEvents(batchEvents);
        } else {
          setFriendEvents((prev) => [...prev, ...batchEvents]);
        }
      }

      // Wait for sync to complete (if it's still running), but don't fail the whole refresh on sync errors
      try {
        await syncPromise;
      } catch (syncError) {
        console.error("Error syncing pending connections:", syncError);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch friends";
      setError(message);
      console.error("Error fetching friends:", err);
      // Still mark as loaded even on error so UI doesn't stay in loading state forever
      hasInitiallyLoadedRef.current = true;
      setHasInitiallyLoaded(true);
    } finally {
      // Only clear loading state if this is still the latest refresh operation
      if (refreshIdRef.current === currentRefreshId) {
        setIsLoading(false);
      }
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
      hasInitiallyLoadedRef.current = false;
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
