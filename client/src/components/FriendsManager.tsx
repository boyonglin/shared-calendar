import { useState, useEffect, useCallback } from "react";
import {
  UserPlus,
  Users,
  X,
  Loader2,
  Check,
  Clock,
  UserCheck,
  UserX,
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
import {
  friendsApi,
  type FriendWithColor,
  type IncomingRequest,
} from "@/services/api/friends";

interface FriendsManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onFriendsChange?: () => void;
  onIncomingRequestsChange?: (count: number) => void;
}

export function FriendsManager({
  isOpen,
  onClose,
  onFriendsChange,
  onIncomingRequestsChange,
}: FriendsManagerProps) {
  const [friends, setFriends] = useState<FriendWithColor[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<IncomingRequest[]>(
    [],
  );
  const [newFriendEmail, setNewFriendEmail] = useState("");
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
      fetchFriends();
      fetchIncomingRequests();
    }
  }, [isOpen, fetchFriends, fetchIncomingRequests]);

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFriendEmail.trim()) return;

    setIsAdding(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await friendsApi.addFriend(newFriendEmail.trim());
      setSuccessMessage(response.message || "Friend request sent!");
      setNewFriendEmail("");
      await fetchFriends();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add friend");
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveFriend = async (friendId: number) => {
    try {
      await friendsApi.removeFriend(friendId);
      await fetchFriends();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove friend");
    }
  };

  const handleAcceptRequest = async (requestId: number) => {
    setProcessingRequestId(requestId);
    setError(null);
    try {
      await friendsApi.acceptRequest(requestId);
      setSuccessMessage("Friend request accepted!");
      await Promise.all([fetchFriends(), fetchIncomingRequests()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept request");
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleRejectRequest = async (requestId: number) => {
    setProcessingRequestId(requestId);
    setError(null);
    try {
      await friendsApi.rejectRequest(requestId);
      await fetchIncomingRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject request");
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleClose = () => {
    setSuccessMessage(null);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Manage Friends
          </DialogTitle>
          <DialogDescription>
            Add friends by email to see their calendar availability.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add Friend Form */}
          <form onSubmit={handleAddFriend} className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type="email"
                placeholder="Enter email address"
                value={newFriendEmail}
                onChange={(e) => setNewFriendEmail(e.target.value)}
                disabled={isAdding}
              />
            </div>
            <Button type="submit" disabled={isAdding || !newFriendEmail.trim()}>
              {isAdding ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
            </Button>
          </form>

          {/* Messages */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm">
              {error}
            </div>
          )}
          {successMessage && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-md text-sm">
              {successMessage}
            </div>
          )}

          {/* Incoming Friend Requests */}
          {incomingRequests.length > 0 && (
            <div className="border rounded-lg border-orange-200 bg-orange-50/50">
              <div className="px-3 py-2 bg-orange-100 border-b border-orange-200 text-sm font-medium text-orange-800 flex items-center gap-2">
                <Inbox className="w-4 h-4" />
                Friend Requests ({incomingRequests.length})
              </div>
              <div className="divide-y divide-orange-100">
                {incomingRequests.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between px-3 py-2"
                  >
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
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAcceptRequest(request.id)}
                        disabled={processingRequestId === request.id}
                        className="h-7"
                      >
                        {processingRequestId === request.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <UserCheck className="w-3 h-3 mr-1" />
                        )}
                        Accept
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRejectRequest(request.id)}
                        disabled={processingRequestId === request.id}
                        className="h-7"
                      >
                        <UserX className="w-3 h-3 mr-1" />
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Friends List */}
          <div className="border rounded-lg">
            <div className="px-3 py-2 bg-gray-50 border-b text-sm font-medium text-gray-700">
              Your Friends ({friends.length})
            </div>
            <ScrollArea className="h-[250px]">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : friends.length === 0 ? (
                <div className="py-8 text-center text-gray-500 text-sm">
                  <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  No friends added yet.
                  <br />
                  Add friends to see their availability!
                </div>
              ) : (
                <div className="divide-y">
                  {friends.map((friend) => (
                    <div
                      key={friend.id}
                      className="flex items-center justify-between px-3 py-2 hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: friend.friendColor }}
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
                          className="text-xs"
                        >
                          {friend.status === "accepted" ? (
                            <Check className="w-3 h-3 mr-1" />
                          ) : (
                            <Clock className="w-3 h-3 mr-1" />
                          )}
                          {friend.status === "accepted"
                            ? "Connected"
                            : friend.status === "requested"
                              ? "Request Sent"
                              : "Pending Signup"}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveFriend(friend.id)}
                          className="h-7 w-7 p-0 text-gray-400 hover:text-red-500"
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

          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-blue-800 text-sm">
              <strong>How it works:</strong>
              <br />• Add a friend&apos;s email address to send a request
              <br />• They&apos;ll need to accept your request to share
              calendars
              <br />• Once accepted, you can see each other&apos;s availability
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
