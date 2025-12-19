import type { User, CalendarEvent, TimeSlot } from "../types";
import { Card, CardContent, CardHeader } from "./ui/card";
import { Button } from "./ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { EventBlock } from "./EventBlock";
import { ScrollArea } from "./ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { MD3DatePicker } from "./ui/md3-date-picker";
import {
  DAYS_IN_WEEK,
  DEFAULT_SCROLL_HOUR,
} from "@shared/core/constants/index";
import { useState, useEffect, useRef } from "react";
import { useEventFiltering } from "@/hooks/useEventFiltering";

interface CalendarViewProps {
  users: User[];
  events: CalendarEvent[];
  currentUserId: string;
  weekStart: Date;
  onTimeSlotSelect: (slot: TimeSlot) => void;
  onWeekChange: (direction: "prev" | "next" | "today") => void;
  onWeekSelect?: (date: Date) => void;
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
  onWeekSelect,
  startHour = 6,
  endHour = 22,
}: CalendarViewProps) {
  // State for week selector popover
  const [isWeekSelectorOpen, setIsWeekSelectorOpen] = useState(false);

  // Filter and deduplicate events, identify mutual events
  const { filteredEvents, mutualEventIds } = useEventFiltering({
    events,
    currentUserId,
    users,
  });

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
    return filteredEvents.filter((event) =>
      isEventInSlot(event, date, hour, minute),
    );
  };

  const getAllDayEventsForDate = (date: Date) => {
    return filteredEvents.filter((event) => {
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

  // Current time indicator state
  const [currentTime, setCurrentTime] = useState(new Date());
  const scrollTargetRef = useRef<HTMLDivElement>(null);
  const scrollAreaViewportRef = useRef<HTMLDivElement>(null);
  const hasScrolledToCurrentTime = useRef(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => window.clearInterval(timer);
  }, []);

  // Scroll to current time (or default time) on initial mount
  useEffect(() => {
    if (
      scrollTargetRef.current &&
      scrollAreaViewportRef.current &&
      !hasScrolledToCurrentTime.current
    ) {
      // Small delay to ensure the layout is complete
      const timeoutId = window.setTimeout(() => {
        const viewport = scrollAreaViewportRef.current;
        const target = scrollTargetRef.current;
        if (viewport && target) {
          // Calculate the scroll position to center the target within the viewport
          const targetOffsetTop = target.offsetTop;
          const viewportHeight = viewport.clientHeight;
          const targetHeight = target.clientHeight;
          // Scroll so the target is roughly centered in the viewport
          const scrollTop =
            targetOffsetTop - viewportHeight / 2 + targetHeight / 2;
          viewport.scrollTop = Math.max(0, scrollTop);
        }
        hasScrolledToCurrentTime.current = true;
      }, 100);
      return () => window.clearTimeout(timeoutId);
    }
  }, []);

  // Calculate current time slot (rounded to 30-minute intervals)
  const getCurrentTimeSlot = () => {
    const now = currentTime;
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    // Round to nearest 30-minute slot: 0-29 -> 0, 30-59 -> 30
    const roundedMinute = currentMinute < 30 ? 0 : 30;

    if (currentHour < validStartHour || currentHour > validEndHour) {
      return null; // Current time is outside visible range
    }

    return { hour: currentHour, minute: roundedMinute };
  };

  const isTodayInWeek = weekDays.some((day) => isToday(day));
  const todayIndex = weekDays.findIndex((day) => isToday(day));
  const currentTimeSlot = getCurrentTimeSlot();

  // Use DEFAULT_SCROLL_HOUR when current time is not visible in this week
  const shouldUseDefaultScroll = !isTodayInWeek || currentTimeSlot === null;
  const defaultScrollTarget =
    DEFAULT_SCROLL_HOUR >= validStartHour && DEFAULT_SCROLL_HOUR <= validEndHour
      ? { hour: DEFAULT_SCROLL_HOUR, minute: 0 }
      : null;

  return (
    <Card className="dark:bg-gray-800 dark:border-gray-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <Popover
            open={isWeekSelectorOpen}
            onOpenChange={setIsWeekSelectorOpen}
          >
            <PopoverTrigger asChild>
              <button className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 font-medium px-2 py-1 rounded-md transition-colors">
                {formatWeekRange()}
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto p-0 border-0 shadow-none bg-transparent"
              align="start"
              sideOffset={8}
            >
              <MD3DatePicker
                selected={weekStart}
                onSelect={(date) => {
                  onWeekSelect?.(date);
                  setIsWeekSelectorOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
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
              aria-label="Previous week"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onWeekChange("next")}
              aria-label="Next week"
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
          <ScrollArea
            className="max-h-[60vh]"
            viewportRef={scrollAreaViewportRef}
          >
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
                              isMutual={mutualEventIds.has(event.id)}
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
              {timeSlots.map(({ hour, minute }) => {
                const isCurrentTimeSlot =
                  isTodayInWeek &&
                  currentTimeSlot !== null &&
                  currentTimeSlot.hour === hour &&
                  currentTimeSlot.minute === minute;

                // Determine if this slot should be the scroll target
                const isScrollTarget =
                  isCurrentTimeSlot ||
                  (shouldUseDefaultScroll &&
                    defaultScrollTarget !== null &&
                    defaultScrollTarget.hour === hour &&
                    defaultScrollTarget.minute === minute);

                return (
                  <div
                    key={`${hour}-${minute}`}
                    className="relative"
                    ref={isScrollTarget ? scrollTargetRef : undefined}
                  >
                    {/* Current time indicator - at junction between slots (hidden on mobile when on the hour) */}
                    {isCurrentTimeSlot && !(currentTimeSlot?.minute === 0) && (
                      <div className="absolute -top-0.5 left-0 right-0 z-10 pointer-events-none grid grid-cols-7 sm:grid-cols-8 gap-px">
                        <div className="hidden sm:block" />
                        {weekDays.map((_day, dayIndex) => (
                          <div
                            key={dayIndex}
                            className="relative px-1 overflow-hidden"
                          >
                            {dayIndex === todayIndex && (
                              <svg
                                className="w-full h-1"
                                viewBox="0 0 100 4"
                                preserveAspectRatio="xMidYMid slice"
                                aria-hidden="true"
                              >
                                <path
                                  d="M0,2 Q2.5,0 5,2 T10,2 T15,2 T20,2 T25,2 T30,2 T35,2 T40,2 T45,2 T50,2 T55,2 T60,2 T65,2 T70,2 T75,2 T80,2 T85,2 T90,2 T95,2 T100,2"
                                  fill="none"
                                  stroke="white"
                                  strokeWidth="1"
                                  strokeOpacity="0.9"
                                />
                              </svg>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Desktop: show wavy line on the hour too */}
                    {isCurrentTimeSlot && currentTimeSlot?.minute === 0 && (
                      <div className="absolute -top-0.5 left-0 right-0 z-10 pointer-events-none hidden sm:grid grid-cols-8 gap-px">
                        <div className="block" />
                        {weekDays.map((_day, dayIndex) => (
                          <div
                            key={dayIndex}
                            className="relative px-1 overflow-hidden"
                          >
                            {dayIndex === todayIndex && (
                              <svg
                                className="w-full h-1"
                                viewBox="0 0 100 4"
                                preserveAspectRatio="xMidYMid slice"
                                aria-hidden="true"
                              >
                                <path
                                  d="M0,2 Q2.5,0 5,2 T10,2 T15,2 T20,2 T25,2 T30,2 T35,2 T40,2 T45,2 T50,2 T55,2 T60,2 T65,2 T70,2 T75,2 T80,2 T85,2 T90,2 T95,2 T100,2"
                                  fill="none"
                                  stroke="white"
                                  strokeWidth="1"
                                  strokeOpacity="0.9"
                                />
                              </svg>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Time indicator row for mobile - only show on the hour */}
                    {minute === 0 && (
                      <div className="sm:hidden flex items-center px-2 py-1">
                        {isCurrentTimeSlot && currentTimeSlot?.minute === 0 ? (
                          <>
                            <svg
                              className="flex-1 h-1"
                              viewBox="0 0 100 4"
                              preserveAspectRatio="none"
                              aria-hidden="true"
                            >
                              <path
                                d="M0,2 Q2.5,0 5,2 T10,2 T15,2 T20,2 T25,2 T30,2 T35,2 T40,2 T45,2 T50,2 T55,2 T60,2 T65,2 T70,2 T75,2 T80,2 T85,2 T90,2 T95,2 T100,2"
                                fill="none"
                                stroke="white"
                                strokeWidth="1"
                                strokeOpacity="0.9"
                              />
                            </svg>
                            <span className="text-[10px] px-2 text-white">
                              {hour > 12 ? hour - 12 : hour || 12}{" "}
                              {hour >= 12 ? "PM" : "AM"}
                            </span>
                            <svg
                              className="flex-1 h-1"
                              viewBox="0 0 100 4"
                              preserveAspectRatio="none"
                              aria-hidden="true"
                            >
                              <path
                                d="M0,2 Q2.5,0 5,2 T10,2 T15,2 T20,2 T25,2 T30,2 T35,2 T40,2 T45,2 T50,2 T55,2 T60,2 T65,2 T70,2 T75,2 T80,2 T85,2 T90,2 T95,2 T100,2"
                                fill="none"
                                stroke="white"
                                strokeWidth="1"
                                strokeOpacity="0.9"
                              />
                            </svg>
                          </>
                        ) : (
                          <>
                            <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600"></div>
                            <span className="text-[10px] px-2 text-gray-400 dark:text-gray-500">
                              {hour > 12 ? hour - 12 : hour || 12}{" "}
                              {hour >= 12 ? "PM" : "AM"}
                            </span>
                            <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600"></div>
                          </>
                        )}
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
                                    isCurrentUser={
                                      event.userId === currentUserId
                                    }
                                    isMutual={mutualEventIds.has(event.id)}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
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
            <p>• Long press or hovering to see event name</p>
            <p>• Bold names = Shared event</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
