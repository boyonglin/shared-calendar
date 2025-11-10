export interface User {
  id: string;
  name: string;
  email: string;
  color: string;
}

export interface CalendarEvent {
  id: string;
  userId: string;
  start: Date;
  end: Date;
}

export interface TimeSlot {
  date: Date;
  hour: number;
}
