import apiClient from './client';
import type {
  LoginRequest,
  LoginResponse,
  SetupRequest,
  SetupResponse,
  PasswordChangeRequest,
} from '@/types';

export const authApi = {
  setup: (data: SetupRequest) =>
    apiClient.post<SetupResponse>('/auth/setup', data),

  login: (data: LoginRequest) =>
    apiClient.post<LoginResponse>('/auth/login', data),

  refresh: (refreshToken: string) =>
    apiClient.post<LoginResponse>('/auth/refresh', { refresh_token: refreshToken }),

  logout: (refreshToken: string) =>
    apiClient.post('/auth/logout', { refresh_token: refreshToken }),

  changePassword: (data: PasswordChangeRequest) =>
    apiClient.put('/auth/password', data),
};
