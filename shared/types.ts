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
  title?: string;
  isAllDay?: boolean;
}

export interface TimeSlot {
  date: Date;
  hour: number;
}

export interface CalendarAccount {
  id: number;
  userId: string;
  provider: 'google' | 'icloud' | 'outlook';
  externalEmail: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}
