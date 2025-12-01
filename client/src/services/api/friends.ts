import { apiClient } from "@/services/api/client";
import type { UserConnection } from "@shared/types";

export interface FriendWithColor extends UserConnection {
  friendColor: string;
}

export interface FriendsListResponse {
  friends: FriendWithColor[];
}

export interface AddFriendResponse {
  success: boolean;
  connection: UserConnection;
  message?: string;
}

export interface RemoveFriendResponse {
  success: boolean;
  message: string;
}

export interface FriendEvent {
  id: string;
  userId: string;
  summary?: string;
  title?: string;
  start?: { dateTime?: string; date?: string } | string;
  end?: { dateTime?: string; date?: string } | string;
  friendConnectionId: number;
}

export interface FriendEventsResponse {
  events: FriendEvent[];
  errors?: Array<{
    provider: string;
    error: string;
    needsReauth: boolean;
  }>;
}

export interface IncomingRequest extends UserConnection {
  friendName: string;
  friendColor: string;
}

export interface IncomingRequestsResponse {
  requests: IncomingRequest[];
  count: number;
}

export interface AcceptRejectResponse {
  success: boolean;
  message: string;
}

export interface SyncPendingResponse {
  success: boolean;
  message: string;
  updatedCount: number;
}

export const friendsApi = {
  // Add a friend by email (sends a request)
  addFriend: (friendEmail: string) =>
    apiClient.post<AddFriendResponse>("/api/friends", { friendEmail }),

  // Get all accepted friends
  getFriends: () => apiClient.get<FriendsListResponse>("/api/friends"),

  // Remove a friend
  removeFriend: (friendId: number) =>
    apiClient.delete<RemoveFriendResponse>(`/api/friends/${friendId}`),

  // Get incoming friend requests
  getIncomingRequests: () =>
    apiClient.get<IncomingRequestsResponse>("/api/friends/requests/incoming"),

  // Accept a friend request
  acceptRequest: (requestId: number) =>
    apiClient.post<AcceptRejectResponse>(`/api/friends/${requestId}/accept`),

  // Reject a friend request
  rejectRequest: (requestId: number) =>
    apiClient.post<AcceptRejectResponse>(`/api/friends/${requestId}/reject`),

  // Sync pending friend connections (check if pending friends have signed up)
  syncPendingConnections: () =>
    apiClient.post<SyncPendingResponse>("/api/friends/sync-pending"),

  // Get a friend's calendar events
  getFriendEvents: async (
    friendId: number,
    timeMin?: Date,
    timeMax?: Date,
  ): Promise<FriendEvent[]> => {
    const params = new URLSearchParams();
    if (timeMin) params.append("timeMin", timeMin.toISOString());
    if (timeMax) params.append("timeMax", timeMax.toISOString());
    const query = params.toString() ? `?${params.toString()}` : "";
    const response = await apiClient.get<FriendEventsResponse>(
      `/api/friends/${friendId}/events${query}`,
    );

    // Log any sync errors for awareness
    if (response.errors && response.errors.length > 0) {
      const reauthErrors = response.errors.filter((e) => e.needsReauth);
      if (reauthErrors.length > 0) {
        console.warn(
          `Friend calendar sync issue: ${reauthErrors.map((e) => e.provider).join(", ")} - ${reauthErrors[0].error}`,
        );
      }
    }

    return response.events || [];
  },
};
