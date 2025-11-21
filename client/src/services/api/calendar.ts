import { apiClient } from './client';

export interface ICloudStatus {
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
  getICloudStatus: () => apiClient.get<ICloudStatus>('/api/calendar/icloud/status'),
  removeICloud: (userId: string) => apiClient.delete(`/api/calendar/icloud/${userId}`),
  getAllEvents: (userId: string, timeMin?: Date, timeMax?: Date) => {
    const params = new URLSearchParams();
    if (timeMin) params.append('timeMin', timeMin.toISOString());
    if (timeMax) params.append('timeMax', timeMax.toISOString());
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<RawCalendarEvent[]>(`/api/calendar/all-events/${userId}${query}`);
  },
  getGoogleEvents: (userId: string, timeMin?: Date, timeMax?: Date) => {
    const params = new URLSearchParams();
    if (timeMin) params.append('timeMin', timeMin.toISOString());
    if (timeMax) params.append('timeMax', timeMax.toISOString());
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<RawCalendarEvent[]>(`/api/calendar/${userId}/events${query}`);
  },
};
