import type { User } from "../types";
import { Checkbox } from "./ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Users } from "lucide-react";

interface UserListProps {
  users: User[];
  selectedUsers: string[];
  currentUserId: string;
  onUserToggle: (userId: string) => void;
  onManageFriends?: () => void;
  isLoggedIn?: boolean;
  incomingRequestCount?: number;
  /** Whether friends data is loading (shows skeleton placeholders) */
  isFriendsLoading?: boolean;
}

/**
 * Skeleton placeholder for a user row during loading
 */
function UserRowSkeleton() {
  return (
    <div
      className="flex items-center gap-3"
      role="status"
      aria-label="Loading friend"
    >
      <div className="h-4 w-4 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
      <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
      <div className="flex-1 space-y-1.5">
        <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
        <div className="h-3 w-32 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
      </div>
    </div>
  );
}

/**
 * Single user row with checkbox and info
 */
function UserRow({
  user,
  isSelected,
  isCurrentUser,
  onToggle,
}: {
  user: User;
  isSelected: boolean;
  isCurrentUser: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <Checkbox
        id={`user-${user.id}`}
        checked={isSelected}
        onCheckedChange={onToggle}
      />
      <label
        htmlFor={`user-${user.id}`}
        className="flex items-center gap-2 flex-1 cursor-pointer"
      >
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-sm"
          style={{ backgroundColor: user.color }}
        >
          {user.name.charAt(0)}
        </div>
        <div className="flex-1">
          <div className="text-gray-900 dark:text-white">
            {user.name}
            {isCurrentUser && (
              <span className="text-gray-500 dark:text-gray-400 ml-1">
                (You)
              </span>
            )}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {user.email}
          </div>
        </div>
      </label>
    </div>
  );
}

export function UserList({
  users,
  selectedUsers,
  currentUserId,
  onUserToggle,
  onManageFriends,
  isLoggedIn,
  incomingRequestCount = 0,
  isFriendsLoading = false,
}: UserListProps) {
  const currentUser = users.find((u) => u.id === currentUserId);
  const otherUsers = users.filter((u) => u.id !== currentUserId);

  return (
    <Card className="dark:bg-gray-800 dark:border-gray-700">
      <CardHeader>
        <div className="flex items-center justify-between lg:flex-col lg:items-stretch lg:gap-3">
          <CardTitle className="dark:text-white">Team Members</CardTitle>
          {isLoggedIn && onManageFriends && (
            <Button
              variant="outline"
              size="sm"
              onClick={onManageFriends}
              className="h-8 lg:h-9 lg:w-full relative"
            >
              <Users className="w-4 h-4 mr-1 lg:mr-2" />
              Manage Friends
              {incomingRequestCount > 0 && (
                <span
                  className={`absolute -top-0.5 -right-0.5 ${
                    incomingRequestCount > 9
                      ? "min-w-4 h-4 px-1 text-xs text-white flex items-center justify-center"
                      : "h-2 w-2"
                  } rounded-full bg-orange-400`}
                >
                  {incomingRequestCount > 9 ? (
                    incomingRequestCount
                  ) : (
                    <span className="sr-only">
                      {incomingRequestCount} pending friend requests
                    </span>
                  )}
                </span>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Current user is always shown first */}
        {currentUser && (
          <UserRow
            user={currentUser}
            isSelected={selectedUsers.includes(currentUser.id)}
            isCurrentUser={true}
            onToggle={() => onUserToggle(currentUser.id)}
          />
        )}

        {/* Loading skeletons while fetching friends */}
        {isFriendsLoading && isLoggedIn && (
          <>
            <UserRowSkeleton />
            <UserRowSkeleton />
          </>
        )}

        {/* Other users (friends or mock data) */}
        {!isFriendsLoading &&
          otherUsers.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              isSelected={selectedUsers.includes(user.id)}
              isCurrentUser={false}
              onToggle={() => onUserToggle(user.id)}
            />
          ))}
      </CardContent>
    </Card>
  );
}
