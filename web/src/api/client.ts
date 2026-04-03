/**
 * Axiosベースの共通APIクライアント
 *
 * - ベースURL: /api/v1
 * - Cookie認証 (withCredentials: true)
 * - 401レスポンス時にリフレッシュトークンで自動再認証
 * - リフレッシュ中の並行リクエストをキューイング
 * - MAX_REFRESH_FAILURES回連続失敗でログイン画面にリダイレクト
 */
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { ErrorResponse } from '@/types';

const API_BASE_URL = '/api/v1';

const REQUEST_TIMEOUT_MS = 30_000;

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: REQUEST_TIMEOUT_MS,
  withCredentials: true,  // Cookie送受信を有効化
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}> = [];
let refreshFailCount = 0;
const MAX_REFRESH_FAILURES = 3;

// Cookie化後はトークンを引数で渡す必要がないため、第2引数を削除
function processQueue(error: unknown) {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(undefined);
    }
  });
  failedQueue = [];
}

// リクエストインターセプターは削除（Cookieが自動送信されるため不要）

// Response interceptor: auto-refresh on 401
apiClient.interceptors.response.use(
  (response) => {
    refreshFailCount = 0;
    return response;
  },
  async (error: AxiosError<ErrorResponse>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (!error.response || !originalRequest) {
      return Promise.reject(error);
    }

    // Auto-refresh on 401 response
    if (error.response.status === 401 && !originalRequest._retry) {
      // /auth/refresh や /auth/login、/auth/me 自体が401の場合はリトライしない
      if (originalRequest.url?.includes('/auth/refresh') || 
          originalRequest.url?.includes('/auth/login') ||
          originalRequest.url?.includes('/auth/me')) {
        return Promise.reject(error);
      }

      if (refreshFailCount >= MAX_REFRESH_FAILURES) {
        window.location.href = '/login';
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => {
          // Cookie化後はトークンを手動で設定する必要がないため、単に再リクエストのみ
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // リフレッシュトークンはCookieで自動送信されるため、ボディは空
        await axios.post(`${API_BASE_URL}/auth/refresh`, {}, {
          withCredentials: true,
        });

        refreshFailCount = 0;
        processQueue(null);
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);

        const isAuthError =
          refreshError instanceof AxiosError && refreshError.response?.status === 401;

        refreshFailCount++;

        if (isAuthError || refreshFailCount >= MAX_REFRESH_FAILURES) {
          refreshFailCount = 0;
          window.location.href = '/login';
        }

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
