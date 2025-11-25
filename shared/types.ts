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
  isAllDay?: boolean;
}

export type ConnectionStatus =
  | "pending"
  | "accepted"
  | "incoming"
  | "requested";

export interface UserConnection {
  id: number;
  userId: string;
  friendEmail: string;
  friendUserId?: string;
  friendName?: string;
  status: ConnectionStatus;
  createdAt: string;
}
