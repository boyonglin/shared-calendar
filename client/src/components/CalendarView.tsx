import type { User, CalendarEvent, TimeSlot } from "../types";
import { Card, CardContent, CardHeader } from "./ui/card";
import { Button } from "./ui/button";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { EventBlock } from "./EventBlock";

interface CalendarViewProps {
  users: User[];
  events: CalendarEvent[];
  currentUserId: string;
  weekStart: Date;
  onTimeSlotSelect: (slot: TimeSlot) => void;
  onWeekChange: (direction: "prev" | "next") => void;
  startHour?: number;
  endHour?: number;
}

export function CalendarView({
  users,
  events,
  currentUserId,
  weekStart,
  onTimeSlotSelect,
  onWeekChange,
  startHour = 6,
  endHour = 22,
}: CalendarViewProps) {
  // Validate hour range
  const validStartHour = Math.max(0, Math.min(23, startHour));
  const validEndHour = Math.max(validStartHour, Math.min(23, endHour));

  // Create half-hour time slots
  const timeSlots = Array.from(
    { length: (validEndHour - validStartHour + 1) * 2 },
    (_, i) => ({
      hour: Math.floor(i / 2) + validStartHour,
      minute: (i % 2) * 30,
    }),
  );
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    return date;
  });

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatWeekRange = () => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    return `${formatDate(weekStart)} - ${formatDate(end)}`;
  };

  const getDayName = (date: Date) => {
    return date.toLocaleDateString("en-US", { weekday: "short" });
  };

  const isEventInSlot = (
    event: CalendarEvent,
    date: Date,
    hour: number,
    minute: number,
  ) => {
    // Don't show all-day events in regular time slots
    if (event.isAllDay) {
      return false;
    }

    const slotStart = new Date(date);
    slotStart.setHours(hour, minute, 0, 0);
    const slotEnd = new Date(date);
    slotEnd.setHours(hour, minute + 30, 0, 0);

    return event.start < slotEnd && event.end > slotStart;
  };

  const getEventsInSlot = (date: Date, hour: number, minute: number) => {
    return events.filter((event) => isEventInSlot(event, date, hour, minute));
  };

  const getAllDayEventsForDate = (date: Date) => {
    return events.filter((event) => {
      if (!event.isAllDay) return false;

      // For multi-day all-day events, check if the date falls within the event range
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);

      // Normalize dates to compare just the date portion (ignore time)
      const checkDate = new Date(date);
      checkDate.setHours(0, 0, 0, 0);

      const startDate = new Date(eventStart);
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(eventEnd);
      endDate.setHours(0, 0, 0, 0);

      // Event spans this date if: startDate <= checkDate <= endDate
      // Using <= for end date to handle both inclusive and exclusive end date formats
      // For exclusive end dates (like Google Calendar), the event still shows correctly
      // For inclusive end dates, we include the last day as well
      return startDate <= checkDate && checkDate <= endDate;
    });
  };

  const getUserColor = (userId: string) => {
    return users.find((u) => u.id === userId)?.color || "#gray-400";
  };

  const handleSlotClick = (date: Date, hour: number, minute: number) => {
    onTimeSlotSelect({ date, hour, minute });
  };

  const handleAllDayClick = (date: Date) => {
    onTimeSlotSelect({ date, hour: 0, isAllDay: true });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-600 mr-1" />
            <span className="text-gray-900">{formatWeekRange()}</span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onWeekChange("prev")}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onWeekChange("next")}
            >
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
                <div
                  key={index}
                  className={`p-3 text-center ${
                    isToday(day) ? "bg-gray-100" : "bg-white"
                  }`}
                >
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
                      className={`p-1 cursor-pointer hover:bg-gray-200 transition-colors relative ${
                        isToday(day) ? "bg-gray-100" : "bg-white"
                      }`}
                      onClick={() => handleAllDayClick(day)}
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
              {timeSlots.map(({ hour, minute }) => (
                <div
                  key={`${hour}-${minute}`}
                  className="grid grid-cols-8 gap-px bg-gray-200 min-h-[40px]"
                >
                  <div className="bg-white p-2 flex items-start">
                    {minute === 0 && (
                      <span className="text-gray-600 text-xs">
                        {hour > 12 ? hour - 12 : hour || 12}:00{" "}
                        {hour >= 12 ? "PM" : "AM"}
                      </span>
                    )}
                  </div>
                  {weekDays.map((day, dayIndex) => {
                    const slotEvents = getEventsInSlot(day, hour, minute);
                    const hasEvents = slotEvents.length > 0;

                    return (
                      <div
                        key={dayIndex}
                        className={`p-1 cursor-pointer hover:bg-gray-200 transition-colors relative ${
                          isToday(day) ? "bg-gray-100" : "bg-white"
                        }`}
                        onClick={() => handleSlotClick(day, hour, minute)}
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
