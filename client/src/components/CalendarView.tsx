import type { User, CalendarEvent, TimeSlot } from "../types";
import { Card, CardContent, CardHeader } from "./ui/card";
import { Button } from "./ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { EventBlock } from "./EventBlock";
import { ScrollArea } from "./ui/scroll-area";
import { DAYS_IN_WEEK } from "@shared/core/constants/index";

interface CalendarViewProps {
  users: User[];
  events: CalendarEvent[];
  currentUserId: string;
  weekStart: Date;
  onTimeSlotSelect: (slot: TimeSlot) => void;
  onWeekChange: (direction: "prev" | "next" | "today") => void;
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
  const weekDays = Array.from({ length: DAYS_IN_WEEK }, (_, i) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    return date;
  });

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatWeekRange = () => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + DAYS_IN_WEEK - 1);
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
    <Card className="dark:bg-gray-800 dark:border-gray-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <span className="text-gray-900 dark:text-white">
            {formatWeekRange()}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onWeekChange("today")}
            >
              Today
            </Button>
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
          {/* Header row with days - 7 columns on mobile, 8 on desktop - FIXED outside scroll */}
          <div className="grid grid-cols-7 sm:grid-cols-8 gap-px border rounded-t-lg overflow-hidden bg-gray-200 border-gray-200 dark:bg-gray-700 dark:border-gray-600">
            <div className="p-1 sm:p-3 hidden sm:block bg-white dark:bg-gray-800">
              <span className="text-xs sm:text-base text-gray-600 dark:text-gray-400">
                Time
              </span>
            </div>
            {weekDays.map((day, index) => (
              <div
                key={index}
                className={`p-1 sm:p-3 text-center ${
                  isToday(day)
                    ? "bg-gray-100 dark:bg-gray-700"
                    : "bg-white dark:bg-gray-800"
                }`}
              >
                <div className="text-xs sm:text-base text-gray-900 dark:text-white">
                  {getDayName(day)}
                </div>
                <div className="text-xs hidden sm:block text-gray-600 dark:text-gray-400">
                  {formatDate(day)}
                </div>
              </div>
            ))}
          </div>

          {/* Scrollable calendar container with max height */}
          <ScrollArea className="max-h-[60vh]">
            {/* All-day row */}
            <div className="border-l border-r sm:border-b border-gray-200 dark:border-gray-600">
              {/* Time indicator row for mobile */}
              <div className="sm:hidden flex items-center px-2 py-1">
                <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600"></div>
                <span className="text-[10px] px-2 text-gray-400 dark:text-gray-500">
                  All-day
                </span>
                <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600"></div>
              </div>
              <div className="grid grid-cols-7 sm:grid-cols-8 gap-px min-h-[40px] sm:min-h-[80px] bg-gray-200 dark:bg-gray-700">
                <div className="p-1 sm:p-3 hidden sm:flex items-start bg-white dark:bg-gray-800">
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    All-day
                  </span>
                </div>
                {weekDays.map((day, dayIndex) => {
                  const allDayEvents = getAllDayEventsForDate(day);
                  const hasEvents = allDayEvents.length > 0;

                  return (
                    <div
                      key={dayIndex}
                      className={`p-1 cursor-pointer transition-colors relative ${
                        isToday(day)
                          ? "bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
                          : "bg-white hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-600"
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
            <div className="border-l border-r border-b rounded-b-lg overflow-hidden border-gray-200 dark:border-gray-600">
              {timeSlots.map(({ hour, minute }) => (
                <div key={`${hour}-${minute}`}>
                  {/* Time indicator row for mobile - only show on the hour */}
                  {minute === 0 && (
                    <div className="sm:hidden flex items-center px-2 py-1">
                      <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600"></div>
                      <span className="text-[10px] px-2 text-gray-400 dark:text-gray-500">
                        {hour > 12 ? hour - 12 : hour || 12}{" "}
                        {hour >= 12 ? "PM" : "AM"}
                      </span>
                      <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600"></div>
                    </div>
                  )}
                  <div className="grid grid-cols-7 sm:grid-cols-8 gap-px min-h-[32px] sm:min-h-[40px] bg-gray-200 dark:bg-gray-700">
                    <div className="p-1 sm:p-2 hidden sm:flex items-start bg-white dark:bg-gray-800">
                      {minute === 0 && (
                        <span className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400">
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
                          className={`p-1 cursor-pointer transition-colors relative ${
                            isToday(day)
                              ? "bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
                              : "bg-white hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-600"
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
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-start gap-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-700">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-gray-700 dark:text-gray-300">
                Team Members:
              </span>
            </div>
            <div className="flex flex-wrap gap-4">
              {users.map((user) => (
                <div key={user.id} className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: user.color }}
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {user.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t pt-4 sm:border-t-0 sm:pt-0 text-sm border-gray-200 text-gray-600 dark:border-gray-600 dark:text-gray-400">
            <p>• Click any free slot to send an invite</p>
            <p className="sm:hidden">• Long press to see event name</p>
            <p>• Colored blocks = Busy</p>
            <p>• Empty slots = Free</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
