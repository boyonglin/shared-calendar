import { useState } from 'react';
import { CalendarView } from './components/CalendarView';
import { UserList } from './components/UserList';
import { InviteDialog } from './components/InviteDialog';
import { User, CalendarEvent, TimeSlot } from './types';

// Mock data for demonstration
const mockUsers: User[] = [
  { id: '1', name: 'Alex Chen', email: 'alex@example.com', color: '#3b82f6' },
  { id: '2', name: 'Sarah Johnson', email: 'sarah@example.com', color: '#10b981' },
  { id: '3', name: 'Michael Brown', email: 'michael@example.com', color: '#f59e0b' },
  { id: '4', name: 'Emma Davis', email: 'emma@example.com', color: '#8b5cf6' },
];

const mockEvents: CalendarEvent[] = [
  { id: '1', userId: '1', start: new Date(2025, 10, 10, 10, 0), end: new Date(2025, 10, 10, 11, 0) },
  { id: '2', userId: '1', start: new Date(2025, 10, 10, 14, 0), end: new Date(2025, 10, 10, 15, 30) },
  { id: '3', userId: '2', start: new Date(2025, 10, 10, 9, 0), end: new Date(2025, 10, 10, 10, 0) },
  { id: '4', userId: '2', start: new Date(2025, 10, 10, 12, 0), end: new Date(2025, 10, 10, 13, 0) },
  { id: '5', userId: '3', start: new Date(2025, 10, 10, 13, 0), end: new Date(2025, 10, 10, 15, 0) },
  { id: '6', userId: '4', start: new Date(2025, 10, 10, 11, 0), end: new Date(2025, 10, 10, 12, 0) },
  { id: '7', userId: '1', start: new Date(2025, 10, 11, 10, 0), end: new Date(2025, 10, 11, 11, 0) },
  { id: '8', userId: '2', start: new Date(2025, 10, 11, 10, 0), end: new Date(2025, 10, 11, 11, 0) },
  { id: '9', userId: '3', start: new Date(2025, 10, 11, 14, 0), end: new Date(2025, 10, 11, 16, 0) },
  { id: '10', userId: '4', start: new Date(2025, 10, 11, 15, 0), end: new Date(2025, 10, 11, 16, 30) },
  { id: '11', userId: '1', start: new Date(2025, 10, 12, 9, 0), end: new Date(2025, 10, 12, 10, 0) },
  { id: '12', userId: '2', start: new Date(2025, 10, 12, 14, 0), end: new Date(2025, 10, 12, 15, 0) },
  { id: '13', userId: '3', start: new Date(2025, 10, 13, 11, 0), end: new Date(2025, 10, 13, 12, 30) },
  { id: '14', userId: '4', start: new Date(2025, 10, 13, 13, 0), end: new Date(2025, 10, 13, 14, 0) },
];

export default function App() {
  const [currentUser] = useState<User>(mockUsers[0]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>(mockUsers.map(u => u.id));
  const [events] = useState<CalendarEvent[]>(mockEvents);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(null);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date(2025, 10, 10); // November 10, 2025
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(today.setDate(diff));
  });

  const handleUserToggle = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleTimeSlotSelect = (slot: TimeSlot) => {
    setSelectedTimeSlot(slot);
  };

  const handleSendInvite = (title: string, description: string, attendees: string[]) => {
    console.log('Sending invite:', { title, description, attendees, timeSlot: selectedTimeSlot });
    // In a real app, this would integrate with calendar APIs
    setSelectedTimeSlot(null);
  };

  const handleWeekChange = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeekStart(newDate);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-gray-900">Calendar Sharing</h1>
              <p className="text-gray-600 mt-1">View and share availability with your team</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white"
                  style={{ backgroundColor: currentUser.color }}
                >
                  {currentUser.name.charAt(0)}
                </div>
                <span className="text-gray-900">{currentUser.name}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <UserList
              users={mockUsers}
              selectedUsers={selectedUsers}
              currentUserId={currentUser.id}
              onUserToggle={handleUserToggle}
            />
          </div>

          <div className="lg:col-span-3">
            <CalendarView
              users={mockUsers.filter(u => selectedUsers.includes(u.id))}
              events={events.filter(e => selectedUsers.includes(e.userId))}
              currentUserId={currentUser.id}
              weekStart={currentWeekStart}
              onTimeSlotSelect={handleTimeSlotSelect}
              onWeekChange={handleWeekChange}
            />
          </div>
        </div>
      </div>

      <InviteDialog
        isOpen={selectedTimeSlot !== null}
        timeSlot={selectedTimeSlot}
        users={mockUsers.filter(u => u.id !== currentUser.id)}
        onClose={() => setSelectedTimeSlot(null)}
        onSendInvite={handleSendInvite}
      />
    </div>
  );
}
