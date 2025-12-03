import { apiClient } from "./client";
import type { GoogleUser } from "../../types/google";

export interface ICloudConnectRequest {
  email: string;
  password: string;
}

export interface ICloudConnectResponse {
  success: boolean;
  user: {
    id: string;
    email: string;
    provider: string;
  };
}

export interface ExchangeCodeResponse {
  userId: string;
  email?: string;
  provider: string;
}

export interface RevokeResponse {
  success: boolean;
  message: string;
}

export interface MeResponse {
  id: string;
  email?: string;
  name?: string;
  picture?: string;
}

export const authApi = {
  /**
   * Verify current session and get user info from JWT cookie
   * Used to restore session on app startup (especially for PWA)
   */
  me: () => apiClient.get<MeResponse>("/api/auth/me"),
  getUser: (userId: string) =>
    apiClient.get<GoogleUser>(`/api/users/${userId}`),
  connectICloud: (credentials: ICloudConnectRequest) =>
    apiClient.post<ICloudConnectResponse>("/api/auth/icloud", credentials),
  /**
   * Exchange a short-lived auth code for user data
   */
  exchangeCode: (code: string) =>
    apiClient.post<ExchangeCodeResponse>("/api/auth/exchange", { code }),
  /**
   * Sign out the current user by clearing the JWT cookie
   */
  logout: () =>
    apiClient.post<{ success: boolean; message: string }>("/api/auth/logout"),
  /**
   * Revoke Google authorization and delete all user data
   */
  revokeAccount: () => apiClient.delete<RevokeResponse>("/api/auth/revoke"),
};
