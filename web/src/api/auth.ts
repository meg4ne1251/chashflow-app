import apiClient from './client';
import type {
  LoginRequest,
  LoginSuccessResponse,
  SetupRequest,
  SetupResponse,
  SetupStatusResponse,
  PasswordChangeRequest,
  AuthMeResponse,
} from '@/types';

export const authApi = {
  setupStatus: () =>
    apiClient.get<SetupStatusResponse>('/auth/setup/status'),

  setup: (data: SetupRequest) =>
    apiClient.post<SetupResponse>('/auth/setup', data),

  login: (data: LoginRequest) =>
    apiClient.post<LoginSuccessResponse>('/auth/login', data),

  // Cookie化によりrefresh_tokenはCookieで自動送信される
  logout: () =>
    apiClient.post('/auth/logout'),

  // 認証状態確認用
  me: () =>
    apiClient.get<AuthMeResponse>('/auth/me'),

  changePassword: (data: PasswordChangeRequest) =>
    apiClient.put('/auth/password', data),
};
