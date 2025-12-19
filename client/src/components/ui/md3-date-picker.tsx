import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "./utils";

interface MD3DatePickerProps {
  selected?: Date;
  onSelect?: (date: Date) => void;
  className?: string;
}

export function MD3DatePicker({
  selected,
  onSelect,
  className,
}: MD3DatePickerProps) {
  const [viewDate, setViewDate] = React.useState(selected || new Date());

  // Sync viewDate with selected prop changes
  React.useEffect(() => {
    if (selected) setViewDate(selected);
  }, [selected]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const monthName = viewDate.toLocaleDateString("en-US", { month: "long" });

  // Get the first day of the month and total days
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();

  // Get the day of week for the first day (0 = Sunday, adjust for Monday start)
  const startDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7; // Convert to Monday = 0

  // Get days from previous month to fill the first row
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  const prevMonthDays = Array.from(
    { length: startDayOfWeek },
    (_, i) => prevMonthLastDay - startDayOfWeek + i + 1,
  );

  // Current month days
  const currentMonthDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Next month days to fill the grid (6 rows × 7 days = 42)
  const totalCells = 42;
  const remainingCells =
    totalCells - prevMonthDays.length - currentMonthDays.length;
  const nextMonthDays = Array.from({ length: remainingCells }, (_, i) => i + 1);

  const navigateMonth = (direction: "prev" | "next") => {
    setViewDate(new Date(year, month + (direction === "next" ? 1 : -1), 1));
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear()
    );
  };

  const isSelected = (day: number) => {
    if (!selected) return false;
    return (
      day === selected.getDate() &&
      month === selected.getMonth() &&
      year === selected.getFullYear()
    );
  };

  const handleDayClick = (day: number) => {
    const newDate = new Date(year, month, day);
    onSelect?.(newDate);
  };

  const weekDays = ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <div
      className={cn(
        "bg-popover dark:bg-gray-800 rounded-xl p-4 w-[280px] shadow-lg border border-border dark:border-gray-700",
        className,
      )}
    >
      {/* Header */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-3">
          <span className="text-foreground dark:text-white text-sm font-medium pl-1">
            {monthName} {year}
          </span>
          <div className="flex gap-0.5">
            <button
              onClick={() => navigateMonth("prev")}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-accent dark:hover:bg-gray-700 transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4 text-muted-foreground dark:text-gray-400" />
            </button>
            <button
              onClick={() => navigateMonth("next")}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-accent dark:hover:bg-gray-700 transition-colors"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4 text-muted-foreground dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-0">
          {weekDays.map((day, index) => (
            <div
              key={index}
              className="w-9 h-9 flex items-center justify-center text-muted-foreground dark:text-gray-500 text-xs font-medium"
            >
              {day}
            </div>
          ))}
        </div>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0">
        {/* Previous month days */}
        {prevMonthDays.map((day, index) => (
          <div
            key={`prev-${index}`}
            className="w-9 h-9 flex items-center justify-center text-muted-foreground/50 dark:text-gray-600 text-sm"
          >
            {day}
          </div>
        ))}

        {/* Current month days */}
        {currentMonthDays.map((day) => {
          const selectedDay = isSelected(day);
          const today = isToday(day);

          return (
            <button
              key={`current-${day}`}
              onClick={() => handleDayClick(day)}
              className={cn(
                "w-9 h-9 flex items-center justify-center text-sm rounded-full transition-colors relative",
                selectedDay
                  ? "bg-primary text-primary-foreground font-medium"
                  : today
                    ? "text-primary font-medium"
                    : "text-foreground dark:text-white hover:bg-accent dark:hover:bg-gray-700",
              )}
            >
              {day}
              {today && !selectedDay && (
                <span className="absolute inset-0 rounded-full border border-primary" />
              )}
            </button>
          );
        })}

        {/* Next month days */}
        {nextMonthDays.map((day, index) => (
          <div
            key={`next-${index}`}
            className="w-9 h-9 flex items-center justify-center text-muted-foreground/50 dark:text-gray-600 text-sm"
          >
            {day}
          </div>
        ))}
      </div>
    </div>
  );
}
