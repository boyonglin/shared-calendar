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
}

export function UserList({
  users,
  selectedUsers,
  currentUserId,
  onUserToggle,
  onManageFriends,
  isLoggedIn,
  incomingRequestCount = 0,
}: UserListProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between lg:flex-col lg:items-stretch lg:gap-3">
          <CardTitle>Team Members</CardTitle>
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
        {users.map((user) => (
          <div key={user.id} className="flex items-center gap-3">
            <Checkbox
              id={`user-${user.id}`}
              checked={selectedUsers.includes(user.id)}
              onCheckedChange={() => onUserToggle(user.id)}
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
                <div className="text-gray-900">
                  {user.name}
                  {user.id === currentUserId && (
                    <span className="text-gray-500 ml-1">(You)</span>
                  )}
                </div>
                <div className="text-gray-500 text-sm">{user.email}</div>
              </div>
            </label>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
