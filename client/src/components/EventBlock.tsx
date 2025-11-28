import { useState, useRef, useCallback } from "react";
import type { CalendarEvent } from "../types";

interface EventBlockProps {
  event: CalendarEvent;
  userColor: string;
  isCurrentUser: boolean;
}

export function EventBlock({
  event,
  userColor,
  isCurrentUser,
}: EventBlockProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const longPressTimer = useRef<number | null>(null);
  const displayText = isCurrentUser && event.title ? event.title : "Busy";

  const handleTouchStart = useCallback((_e: React.TouchEvent) => {
    longPressTimer.current = window.setTimeout(() => {
      setShowTooltip(true);
    }, 500); // 500ms long press
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    // Hide tooltip after a delay so user can read it
    if (showTooltip) {
      window.setTimeout(() => setShowTooltip(false), 1500);
    }
  }, [showTooltip]);

  const handleTouchMove = useCallback(() => {
    // Cancel long press if user moves finger
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    // Prevent default context menu on long press
    e.preventDefault();
  }, []);

  return (
    <div
      className="rounded text-white text-sm relative overflow-visible flex items-center justify-center w-full h-8 sm:w-auto sm:h-auto sm:p-2 touch-none"
      style={{
        backgroundColor: userColor,
        opacity: 0.9,
      }}
      title={isCurrentUser && event.title ? event.title : undefined}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onContextMenu={handleContextMenu}
    >
      <span className="hidden sm:inline truncate">{displayText}</span>

      {/* Mobile tooltip on long press */}
      {showTooltip && (
        <div className="sm:hidden absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-3 px-2 py-1 bg-gray-900 text-white text-xs rounded shadow-lg whitespace-nowrap">
          {displayText}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  );
}
