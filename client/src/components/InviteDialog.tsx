import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { TimeSlot, User } from '../types';
import { Calendar, Clock } from 'lucide-react';

interface InviteDialogProps {
  isOpen: boolean;
  timeSlot: TimeSlot | null;
  users: User[];
  onClose: () => void;
  onSendInvite: (title: string, description: string, attendees: string[]) => void;
}

export function InviteDialog({
  isOpen,
  timeSlot,
  users,
  onClose,
  onSendInvite,
}: InviteDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) {
      setTitle('');
      setDescription('');
      setSelectedAttendees([]);
    }
  }, [isOpen]);

  const handleAttendeeToggle = (userId: string) => {
    setSelectedAttendees((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const handleSubmit = () => {
    if (!title.trim()) return;
    onSendInvite(title, description, selectedAttendees);
  };

  const formatDateTime = () => {
    if (!timeSlot) return '';
    const { date, hour } = timeSlot;
    const dateStr = date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    const timeStr = `${hour > 12 ? hour - 12 : hour}:00 ${hour >= 12 ? 'PM' : 'AM'}`;
    return `${dateStr} at ${timeStr}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose} modal>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Calendar Invite</DialogTitle>
          <DialogDescription>
            Schedule a meeting with your team members at the selected time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {timeSlot && (
            <div className="bg-gray-50 p-3 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-gray-700">
                <Calendar className="w-4 h-4" />
                <span className="text-sm">{formatDateTime()}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-700">
                <Clock className="w-4 h-4" />
                <span className="text-sm">Duration: 1 hour</span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="title">Event Title</Label>
            <Input
              id="title"
              placeholder="e.g., Team Sync Meeting"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="Add meeting details, agenda, or notes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Invite Attendees</Label>
            <div className="border rounded-lg p-3 space-y-3 max-h-[200px] overflow-y-auto">
              {users.map((user) => (
                <div key={user.id} className="flex items-center gap-3">
                  <Checkbox
                    id={`attendee-${user.id}`}
                    checked={selectedAttendees.includes(user.id)}
                    onCheckedChange={() => handleAttendeeToggle(user.id)}
                  />
                  <label
                    htmlFor={`attendee-${user.id}`}
                    className="flex items-center gap-2 flex-1 cursor-pointer"
                  >
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-sm"
                      style={{ backgroundColor: user.color }}
                    >
                      {user.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-gray-900 text-sm">{user.name}</div>
                      <div className="text-gray-500 text-xs">{user.email}</div>
                    </div>
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-blue-800 text-sm">
              <strong>Note:</strong> In production, this will send calendar invites via Google
              Calendar, Outlook, or other integrated calendar platforms.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!title.trim()}>
            Send Invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
