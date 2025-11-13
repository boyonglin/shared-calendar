import { CalendarEvent } from '../types';

interface EventBlockProps {
  event: CalendarEvent;
  userColor: string;
  isCurrentUser: boolean;
}

export function EventBlock({ event, userColor, isCurrentUser }: EventBlockProps) {
  const displayText = isCurrentUser && event.title ? event.title : 'Busy';

  return (
    <div
      className="rounded p-2 text-white text-sm relative overflow-hidden flex items-center justify-center"
      style={{
        backgroundColor: userColor,
        opacity: 0.9,
      }}
      title={isCurrentUser && event.title ? event.title : undefined}
    >
      <span className="truncate">{displayText}</span>
    </div>
  );
}
