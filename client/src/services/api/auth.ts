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

export const authApi = {
  getUser: (userId: string) =>
    apiClient.get<GoogleUser>(`/api/users/${userId}`),
  connectICloud: (credentials: ICloudConnectRequest) =>
    apiClient.post<ICloudConnectResponse>("/api/auth/icloud", credentials),
};
