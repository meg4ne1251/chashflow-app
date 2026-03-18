import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { ErrorResponse } from '@/types';

const API_BASE_URL = '/api/v1';

const REQUEST_TIMEOUT_MS = 30_000;

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: REQUEST_TIMEOUT_MS,
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}> = [];
let refreshFailCount = 0;
const MAX_REFRESH_FAILURES = 3;

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token);
    }
  });
  failedQueue = [];
}

// Request interceptor: attach access token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('access_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: auto-refresh on 401 TOKEN_EXPIRED
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

    // Auto-refresh on any 401 response (expired token, invalid token, etc.)
    if (
      error.response.status === 401 &&
      !originalRequest._retry
    ) {
      if (refreshFailCount >= MAX_REFRESH_FAILURES) {
        clearAuthTokens();
        window.location.href = '/login';
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
          }
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) {
          clearAuthTokens();
          window.location.href = '/login';
          return Promise.reject(new Error('No refresh token'));
        }

        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });

        const { access_token, refresh_token } = response.data;
        localStorage.setItem('access_token', access_token);
        localStorage.setItem('refresh_token', refresh_token);
        refreshFailCount = 0;

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
        }

        processQueue(null, access_token);
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);

        // If the refresh endpoint itself returns 401, the session is definitively
        // expired — retrying won't help. Redirect to login immediately.
        const isAuthError =
          refreshError instanceof AxiosError && refreshError.response?.status === 401;

        refreshFailCount++;

        if (isAuthError || refreshFailCount >= MAX_REFRESH_FAILURES) {
          refreshFailCount = 0;
          clearAuthTokens();
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

function clearAuthTokens() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
}

export { clearAuthTokens };
export default apiClient;
