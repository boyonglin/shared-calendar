import { User, CalendarEvent, TimeSlot } from '../types';
import { Card, CardContent, CardHeader } from './ui/card';
import { Button } from './ui/button';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { EventBlock } from './EventBlock';

interface CalendarViewProps {
  users: User[];
  events: CalendarEvent[];
  currentUserId: string;
  weekStart: Date;
  onTimeSlotSelect: (slot: TimeSlot) => void;
  onWeekChange: (direction: 'prev' | 'next') => void;
}

export function CalendarView({
  users,
  events,
  currentUserId,
  weekStart,
  onTimeSlotSelect,
  onWeekChange,
}: CalendarViewProps) {
  const hours = Array.from({ length: 12 }, (_, i) => i + 8); // 8 AM to 7 PM
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    return date;
  });

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatWeekRange = () => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    return `${formatDate(weekStart)} - ${formatDate(end)}`;
  };

  const getDayName = (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  const isEventInSlot = (event: CalendarEvent, date: Date, hour: number) => {
    // Don't show all-day events in regular time slots
    if (event.isAllDay) {
      return false;
    }

    const slotStart = new Date(date);
    slotStart.setHours(hour, 0, 0, 0);
    const slotEnd = new Date(date);
    slotEnd.setHours(hour + 1, 0, 0, 0);

    return event.start < slotEnd && event.end > slotStart;
  };

  const getEventsInSlot = (date: Date, hour: number) => {
    return events.filter(event => isEventInSlot(event, date, hour));
  };

  const getAllDayEventsForDate = (date: Date) => {
    return events.filter(event => {
      if (!event.isAllDay) return false;

      const eventDate = new Date(event.start);
      return eventDate.toDateString() === date.toDateString();
    });
  };

  const getUserColor = (userId: string) => {
    return users.find(u => u.id === userId)?.color || '#gray-400';
  };

  const handleSlotClick = (date: Date, hour: number) => {
    onTimeSlotSelect({ date, hour });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-600" />
            <span className="text-gray-900">{formatWeekRange()}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onWeekChange('prev')}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => onWeekChange('next')}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Header row with days */}
            <div className="grid grid-cols-8 gap-px bg-gray-200 border border-gray-200">
              <div className="bg-white p-3">
                <span className="text-gray-600">Time</span>
              </div>
              {weekDays.map((day, index) => (
                <div key={index} className="bg-white p-3 text-center">
                  <div className="text-gray-900">{getDayName(day)}</div>
                  <div className="text-gray-600 text-sm">{formatDate(day)}</div>
                </div>
              ))}
            </div>

            {/* All-day row */}
            <div className="border-l border-r border-b border-gray-200">
              <div className="grid grid-cols-8 gap-px bg-gray-200 min-h-[80px]">
                <div className="bg-white p-3 flex items-start">
                  <span className="text-gray-600 text-sm">All-day</span>
                </div>
                {weekDays.map((day, dayIndex) => {
                  const allDayEvents = getAllDayEventsForDate(day);
                  const hasEvents = allDayEvents.length > 0;

                  return (
                    <div
                      key={dayIndex}
                      className="bg-white p-1 cursor-pointer hover:bg-gray-50 transition-colors relative"
                    >
                      {hasEvents && (
                        <div className="space-y-1 h-full">
                          {allDayEvents.map((event) => (
                            <EventBlock
                              key={event.id}
                              event={event}
                              userColor={getUserColor(event.userId)}
                              isCurrentUser={event.userId === currentUserId}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Time slots */}
            <div className="border-l border-r border-b border-gray-200">
              {hours.map((hour) => (
                <div key={hour} className="grid grid-cols-8 gap-px bg-gray-200 min-h-[80px]">
                  <div className="bg-white p-3 flex items-start">
                    <span className="text-gray-600 text-sm">
                      {hour > 12 ? hour - 12 : hour}:00 {hour >= 12 ? 'PM' : 'AM'}
                    </span>
                  </div>
                  {weekDays.map((day, dayIndex) => {
                    const slotEvents = getEventsInSlot(day, hour);
                    const hasEvents = slotEvents.length > 0;

                    return (
                      <div
                        key={dayIndex}
                        className="bg-white p-1 cursor-pointer hover:bg-gray-50 transition-colors relative"
                        onClick={() => handleSlotClick(day, hour)}
                      >
                        {hasEvents && (
                          <div className="space-y-1 h-full">
                            {slotEvents.map((event) => (
                              <EventBlock
                                key={event.id}
                                event={event}
                                userColor={getUserColor(event.userId)}
                                isCurrentUser={event.userId === currentUserId}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-gray-700">Team Members:</span>
            </div>
            <div className="flex flex-wrap gap-4">
              {users.map((user) => (
                <div key={user.id} className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: user.color }}
                  />
                  <span className="text-gray-700 text-sm">{user.name}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="text-gray-600 text-sm">
            <p>• Click any free slot to send an invite</p>
            <p>• Colored blocks = Busy</p>
            <p>• Empty slots = Free</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
