import { User } from '../types';
import { Checkbox } from './ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface UserListProps {
  users: User[];
  selectedUsers: string[];
  currentUserId: string;
  onUserToggle: (userId: string) => void;
}

export function UserList({ users, selectedUsers, currentUserId, onUserToggle }: UserListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Team Members</CardTitle>
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
                  {user.id === currentUserId && <span className="text-gray-500 ml-1">(You)</span>}
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
