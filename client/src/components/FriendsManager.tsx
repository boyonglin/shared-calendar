import { useState, useEffect, useCallback } from "react";
import {
  UserPlus,
  Users,
  X,
  Loader2,
  UserCheck,
  UserX,
  Mail,
  Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  friendsApi,
  type FriendWithColor,
  type IncomingRequest,
} from "@/services/api/friends";

// Generate a temporary ID for optimistic updates
const generateTempId = () => -Date.now();

// Default colors for new friends (matches server-side color assignment)
const FRIEND_COLORS = [
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
  "#f97316",
  "#6366f1",
  "#14b8a6",
  "#a855f7",
];

/**
 * Reusable avatar component for displaying user initials
 */
function UserAvatar({
  name,
  email,
  color,
}: {
  name?: string | null;
  email: string;
  color?: string;
}) {
  const initials = name
    ? name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : email.slice(0, 2).toUpperCase();

  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium text-sm"
      style={{ backgroundColor: color || "#3b82f6" }}
    >
      {initials}
    </div>
  );
}

interface FriendsManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onFriendsChange?: () => void;
  onIncomingRequestsChange?: (count: number) => void;
  initialTab?: TabValue;
}

type TabValue = "friends" | "add" | "requests";

export function FriendsManager({
  isOpen,
  onClose,
  onFriendsChange,
  onIncomingRequestsChange,
  initialTab = "friends",
}: FriendsManagerProps) {
  const [activeTab, setActiveTab] = useState<TabValue>(initialTab);
  const [friends, setFriends] = useState<FriendWithColor[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<IncomingRequest[]>(
    [],
  );
  const [newFriendEmail, setNewFriendEmail] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [processingRequestId, setProcessingRequestId] = useState<number | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchFriends = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await friendsApi.getFriends();
      setFriends(response.friends);
      onFriendsChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load friends");
    } finally {
      setIsLoading(false);
    }
  }, [onFriendsChange]);

  const fetchIncomingRequests = useCallback(async () => {
    try {
      const response = await friendsApi.getIncomingRequests();
      setIncomingRequests(response.requests);
      onIncomingRequestsChange?.(response.requests.length);
    } catch (err) {
      console.error("Failed to fetch incoming requests:", err);
    }
  }, [onIncomingRequestsChange]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      fetchFriends();
      fetchIncomingRequests();
    }
  }, [isOpen, initialTab, fetchFriends, fetchIncomingRequests]);

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = newFriendEmail.trim();
    if (!email) return;

    setIsAdding(true);
    setError(null);
    setSuccessMessage(null);

    // Optimistic update: add pending friend immediately
    const tempId = generateTempId();
    const optimisticFriend: FriendWithColor = {
      id: tempId,
      friendEmail: email,
      friendName: null,
      friendUserId: null,
      friendColor: FRIEND_COLORS[friends.length % FRIEND_COLORS.length],
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    setFriends((prev) => [...prev, optimisticFriend]);
    setNewFriendEmail("");

    try {
      const response = await friendsApi.addFriend(email);
      setSuccessMessage(response.message || "Friend request sent!");
      // Refresh to get the actual friend data from server
      await fetchFriends();
    } catch (err) {
      // Rollback optimistic update on error
      setFriends((prev) => prev.filter((f) => f.id !== tempId));
      setNewFriendEmail(email); // Restore email for retry
      setError(err instanceof Error ? err.message : "Failed to add friend");
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveFriend = async (friendId: number) => {
    // Store friend for rollback
    const friendToRemove = friends.find((f) => f.id === friendId);
    if (!friendToRemove) return;

    // Optimistic update: remove immediately
    setFriends((prev) => prev.filter((f) => f.id !== friendId));

    try {
      await friendsApi.removeFriend(friendId);
      onFriendsChange?.();
    } catch (err) {
      // Rollback on error
      setFriends((prev) => [...prev, friendToRemove]);
      setError(err instanceof Error ? err.message : "Failed to remove friend");
    }
  };

  const handleAcceptRequest = async (requestId: number) => {
    setProcessingRequestId(requestId);
    setError(null);

    // Find the request being accepted
    const acceptedRequest = incomingRequests.find((r) => r.id === requestId);
    if (!acceptedRequest) return;

    // Optimistic update: remove from requests, add to friends
    setIncomingRequests((prev) => prev.filter((r) => r.id !== requestId));
    onIncomingRequestsChange?.(incomingRequests.length - 1);

    const optimisticFriend: FriendWithColor = {
      id: generateTempId(),
      friendEmail: acceptedRequest.friendEmail,
      friendName: acceptedRequest.friendName,
      friendUserId: acceptedRequest.friendUserId,
      friendColor: FRIEND_COLORS[friends.length % FRIEND_COLORS.length],
      status: "accepted",
      createdAt: new Date().toISOString(),
    };
    setFriends((prev) => [...prev, optimisticFriend]);

    try {
      await friendsApi.acceptRequest(requestId);
      setSuccessMessage("Friend request accepted!");
      // Refresh to get actual data
      await Promise.all([fetchFriends(), fetchIncomingRequests()]);
    } catch (err) {
      // Rollback on error
      setIncomingRequests((prev) => [...prev, acceptedRequest]);
      setFriends((prev) => prev.filter((f) => f.id !== optimisticFriend.id));
      onIncomingRequestsChange?.(incomingRequests.length);
      setError(err instanceof Error ? err.message : "Failed to accept request");
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleRejectRequest = async (requestId: number) => {
    setProcessingRequestId(requestId);
    setError(null);

    // Store for rollback
    const rejectedRequest = incomingRequests.find((r) => r.id === requestId);
    if (!rejectedRequest) return;

    // Optimistic update: remove immediately
    setIncomingRequests((prev) => prev.filter((r) => r.id !== requestId));
    onIncomingRequestsChange?.(incomingRequests.length - 1);

    try {
      await friendsApi.rejectRequest(requestId);
    } catch (err) {
      // Rollback on error
      setIncomingRequests((prev) => [...prev, rejectedRequest]);
      onIncomingRequestsChange?.(incomingRequests.length);
      setError(err instanceof Error ? err.message : "Failed to reject request");
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleClose = () => {
    setSuccessMessage(null);
    setError(null);
    setActiveTab("friends");
    setSearchQuery("");
    setNewFriendEmail("");
    onClose();
  };

  // Filter friends based on search query
  const filteredFriends = friends.filter((friend) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      friend.friendEmail.toLowerCase().includes(query) ||
      (friend.friendName?.toLowerCase().includes(query) ?? false)
    );
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Friends & Connections
          </DialogTitle>
          <DialogDescription>
            Manage who you share your calendar with.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as TabValue)}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="friends">My Friends</TabsTrigger>
            <TabsTrigger value="add">Add Friend</TabsTrigger>
            <TabsTrigger value="requests">
              Requests
              {incomingRequests.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {incomingRequests.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Messages - shown on all tabs */}
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm">
              {error}
            </div>
          )}
          {successMessage && (
            <div className="mt-4 bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-md text-sm">
              {successMessage}
            </div>
          )}

          {/* My Friends Tab */}
          <TabsContent value="friends" className="mt-4">
            <div className="space-y-4">
              {/* Search Input */}
              <Input
                type="text"
                placeholder="Search friends by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />

              {/* Friends List */}
              <ScrollArea className="h-[280px]">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  </div>
                ) : filteredFriends.length === 0 ? (
                  <div className="py-8 text-center text-gray-500 text-sm">
                    <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    {searchQuery ? (
                      <>No friends matching &quot;{searchQuery}&quot;</>
                    ) : (
                      <>
                        No friends added yet.
                        <br />
                        Add friends to see their availability!
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredFriends.map((friend) => (
                      <div
                        key={friend.id}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            name={friend.friendName}
                            email={friend.friendEmail}
                            color={friend.friendColor}
                          />
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {friend.friendName || friend.friendEmail}
                            </div>
                            {friend.friendName && (
                              <div className="text-xs text-gray-500">
                                {friend.friendEmail}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              friend.status === "accepted"
                                ? "default"
                                : "secondary"
                            }
                            className={`text-xs ${
                              friend.status === "accepted"
                                ? "bg-green-100 text-green-700 hover:bg-green-100"
                                : friend.status === "requested"
                                  ? "bg-orange-100 text-orange-700 hover:bg-orange-100"
                                  : "bg-gray-100 text-gray-700 hover:bg-gray-100"
                            }`}
                          >
                            {friend.status === "accepted"
                              ? "Connected"
                              : friend.status === "requested"
                                ? "Pending"
                                : "Pending Signup"}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveFriend(friend.id)}
                            className="h-7 w-7 p-0 text-gray-400 hover:text-red-500"
                            aria-label="Remove friend"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </TabsContent>

          {/* Add Friend Tab */}
          <TabsContent value="add" className="mt-4">
            <div className="flex flex-col items-center py-6 space-y-4">
              <UserPlus className="w-12 h-12 text-gray-400" />
              <div className="text-center">
                <h3 className="font-medium text-gray-900">Add a Friend</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Enter your friend&apos;s email address to send them an
                  <br />
                  invitation to share calendars.
                </p>
              </div>
              <form onSubmit={handleAddFriend} className="w-full space-y-3">
                <Input
                  type="email"
                  placeholder="friend@example.com"
                  value={newFriendEmail}
                  onChange={(e) => setNewFriendEmail(e.target.value)}
                  disabled={isAdding}
                  className="text-center"
                />
                <Button
                  type="submit"
                  disabled={isAdding || !newFriendEmail.trim()}
                  className="w-full"
                >
                  {isAdding ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Mail className="w-4 h-4 mr-2" />
                  )}
                  Send Invitation
                </Button>
              </form>
            </div>
          </TabsContent>

          {/* Requests Tab */}
          <TabsContent value="requests" className="mt-4">
            <ScrollArea className="h-[280px]">
              {incomingRequests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                  <Inbox className="w-12 h-12 text-gray-300 mb-3" />
                  <p className="font-medium">No pending requests.</p>
                  <p className="text-sm text-gray-400">
                    Requests sent to you will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {incomingRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          name={request.friendName}
                          email={request.friendEmail}
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {request.friendName || request.friendEmail}
                          </div>
                          {request.friendName &&
                            request.friendName !== request.friendEmail && (
                              <div className="text-xs text-gray-500">
                                {request.friendEmail}
                              </div>
                            )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAcceptRequest(request.id)}
                          disabled={processingRequestId === request.id}
                          className="h-8 w-8 p-0"
                          aria-label="Accept request"
                        >
                          {processingRequestId === request.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <UserCheck className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRejectRequest(request.id)}
                          disabled={processingRequestId === request.id}
                          className="h-8 w-8 p-0 text-gray-400 hover:text-red-500"
                          aria-label="Decline request"
                        >
                          <UserX className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
