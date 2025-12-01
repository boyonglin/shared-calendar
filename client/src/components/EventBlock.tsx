import { useState, useRef, useCallback, useEffect, useId } from "react";
import { createPortal } from "react-dom";
import type { CalendarEvent } from "../types";

// Custom event name for closing all tooltips
const CLOSE_TOOLTIPS_EVENT = "eventblock:closetooltips";

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
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const longPressTimer = useRef<number | null>(null);
  const hideTooltipTimer = useRef<number | null>(null);
  const blockRef = useRef<HTMLDivElement>(null);
  const instanceId = useId();
  const displayText = isCurrentUser && event.title ? event.title : "Busy";

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        window.clearTimeout(longPressTimer.current);
      }
      if (hideTooltipTimer.current) {
        window.clearTimeout(hideTooltipTimer.current);
      }
    };
  }, []);

  // Listen for close tooltip events from other instances
  useEffect(() => {
    const handleCloseTooltips = (e: globalThis.Event) => {
      const customEvent = e as globalThis.CustomEvent<{ sourceId: string }>;
      // Close this tooltip if another instance triggered the event
      if (customEvent.detail.sourceId !== instanceId) {
        setShowTooltip(false);
        if (hideTooltipTimer.current) {
          window.clearTimeout(hideTooltipTimer.current);
          hideTooltipTimer.current = null;
        }
      }
    };

    document.addEventListener(CLOSE_TOOLTIPS_EVENT, handleCloseTooltips);
    return () => {
      document.removeEventListener(CLOSE_TOOLTIPS_EVENT, handleCloseTooltips);
    };
  }, [instanceId]);

  // Hide tooltip on scroll
  useEffect(() => {
    if (!showTooltip) return;

    const handleScroll = () => {
      setShowTooltip(false);
      if (hideTooltipTimer.current) {
        window.clearTimeout(hideTooltipTimer.current);
        hideTooltipTimer.current = null;
      }
    };

    // Listen to scroll on window and any scrollable parent
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [showTooltip]);

  const updateTooltipPosition = useCallback(() => {
    if (blockRef.current) {
      const rect = blockRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;

      // Calculate tooltip half-width based on actual max-width (min of 200px or 80vw)
      const tooltipMaxWidth = Math.min(200, viewportWidth * 0.8);
      const tooltipHalfWidth = tooltipMaxWidth / 2;

      // Calculate left position, clamping to keep tooltip within viewport
      let left = rect.left + rect.width / 2;
      // Ensure tooltip doesn't go off-screen using calculated half-width with padding
      left = Math.max(
        tooltipHalfWidth + 8,
        Math.min(viewportWidth - tooltipHalfWidth - 8, left),
      );

      setTooltipPosition({
        top: rect.top - 12, // Position above the element with some margin (4px higher)
        left: left,
      });
    }
  }, []);

  const handleTouchStart = useCallback(() => {
    // Clear any existing hide timer
    if (hideTooltipTimer.current) {
      window.clearTimeout(hideTooltipTimer.current);
      hideTooltipTimer.current = null;
    }

    longPressTimer.current = window.setTimeout(() => {
      // Dispatch event to close other tooltips before showing this one
      document.dispatchEvent(
        new globalThis.CustomEvent(CLOSE_TOOLTIPS_EVENT, {
          detail: { sourceId: instanceId },
        }),
      );
      updateTooltipPosition();
      setShowTooltip(true);
    }, 500); // 500ms long press
  }, [updateTooltipPosition, instanceId]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    // Hide tooltip after a longer delay so user can read it
    if (showTooltip) {
      hideTooltipTimer.current = window.setTimeout(
        () => setShowTooltip(false),
        3000, // Increased to 3 seconds for better readability
      );
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

  // Tooltip component rendered via portal to avoid z-index issues
  const tooltip = showTooltip
    ? createPortal(
        <div
          className="sm:hidden fixed z-[9999] px-3 py-2 bg-gray-900 text-white text-sm rounded-lg shadow-xl pointer-events-none text-center"
          style={{
            top: tooltipPosition.top,
            left: tooltipPosition.left,
            transform: "translate(-50%, -100%)",
            maxWidth: "min(200px, 80vw)",
            wordWrap: "break-word",
            whiteSpace: "normal",
          }}
        >
          {displayText}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-gray-900"></div>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <div
        ref={blockRef}
        className="rounded text-white text-sm relative overflow-visible flex items-center justify-center w-full h-8 sm:w-auto sm:h-auto sm:p-2 touch-manipulation select-none"
        style={{
          backgroundColor: userColor,
          opacity: 0.9,
          WebkitTouchCallout: "none",
          WebkitUserSelect: "none",
        }}
        title={isCurrentUser && event.title ? event.title : undefined}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        onContextMenu={handleContextMenu}
      >
        <span className="hidden sm:inline truncate">{displayText}</span>
      </div>
      {tooltip}
    </>
  );
}
