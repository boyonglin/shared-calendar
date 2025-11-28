import { apiClient, type SSEMessage } from "@/services/api/client";

export interface ICloudStatus {
  connected: boolean;
  email?: string;
  userId?: string;
}

export interface OutlookStatus {
  connected: boolean;
  email?: string;
  userId?: string;
}

export interface RawCalendarEvent {
  id: string;
  userId?: string;
  summary?: string;
  title?: string;
  start?: { dateTime?: string; date?: string } | string;
  end?: { dateTime?: string; date?: string } | string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export const calendarApi = {
  getICloudStatus: () =>
    apiClient.get<ICloudStatus>("/api/calendar/icloud/status"),
  removeICloud: (userId: string) =>
    apiClient.delete(`/api/calendar/icloud/${userId}`),
  getOutlookStatus: () =>
    apiClient.get<OutlookStatus>("/api/calendar/outlook/status"),
  removeOutlook: (userId: string) =>
    apiClient.delete(`/api/calendar/outlook/${userId}`),
  getAllEvents: (userId: string, timeMin?: Date, timeMax?: Date) => {
    const params = new URLSearchParams();
    if (timeMin) params.append("timeMin", timeMin.toISOString());
    if (timeMax) params.append("timeMax", timeMax.toISOString());
    const query = params.toString() ? `?${params.toString()}` : "";
    return apiClient.get<RawCalendarEvent[]>(
      `/api/calendar/all-events/${userId}${query}`,
    );
  },
  /**
   * Stream events from all calendar providers as each completes
   * Events are delivered progressively via SSE, reducing wait time
   */
  streamAllEvents: (
    userId: string,
    timeMin: Date | undefined,
    timeMax: Date | undefined,
    onEvents: (events: RawCalendarEvent[], provider: string) => void,
    onComplete: () => void,
    onError?: (error: Error) => void,
  ): AbortController => {
    const params = new URLSearchParams();
    if (timeMin) params.append("timeMin", timeMin.toISOString());
    if (timeMax) params.append("timeMax", timeMax.toISOString());
    const query = params.toString() ? `?${params.toString()}` : "";

    return apiClient.streamSSE<RawCalendarEvent>(
      `/api/calendar/events-stream/${userId}${query}`,
      (message: SSEMessage<RawCalendarEvent>) => {
        if (message.type === "events" && message.events) {
          onEvents(message.events, message.provider || "unknown");
        } else if (message.type === "complete") {
          onComplete();
        } else if (message.type === "error") {
          console.warn(`Calendar provider error (${message.provider}):`, message.message);
          // Don't call onError for individual provider errors, just log them
        }
      },
      onError,
    );
  },
  createEvent: (data: {
    title: string;
    description?: string;
    start: string;
    end: string;
    attendees?: string[];
    isAllDay?: boolean;
  }) => {
    return apiClient.post<RawCalendarEvent>("/api/calendar/events", data);
  },
};
