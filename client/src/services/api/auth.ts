import { apiClient } from './client';
import { GoogleUser } from '../../types/google';

export const authApi = {
  connectICloud: (data: { email: string; password: string }) =>
    apiClient.post<{ user: { id: string } }>('/api/auth/icloud', data),
  getUser: (userId: string) => apiClient.get<GoogleUser>(`/api/users/${userId}`),
};
