import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi } from '@/api/auth';
import { clearAuthTokens } from '@/api/client';

interface AuthState {
  isAuthenticated: boolean;
  username: string | null;
  login: (username: string, password: string) => Promise<void>;
  setup: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: !!localStorage.getItem('access_token'),
      username: null,

      login: async (username: string, password: string) => {
        const response = await authApi.login({ username, password });
        const { access_token, refresh_token } = response.data;
        localStorage.setItem('access_token', access_token);
        localStorage.setItem('refresh_token', refresh_token);
        set({ isAuthenticated: true, username });
      },

      setup: async (username: string, password: string) => {
        await authApi.setup({ username, password });
        // After setup, auto-login
        const loginResponse = await authApi.login({ username, password });
        const { access_token, refresh_token } = loginResponse.data;
        localStorage.setItem('access_token', access_token);
        localStorage.setItem('refresh_token', refresh_token);
        set({ isAuthenticated: true, username });
      },

      logout: async () => {
        try {
          const refreshToken = localStorage.getItem('refresh_token');
          if (refreshToken) {
            await authApi.logout(refreshToken);
          }
        } catch {
          // Ignore logout errors
        } finally {
          clearAuthTokens();
          set({ isAuthenticated: false, username: null });
        }
      },

      checkAuth: () => {
        return !!localStorage.getItem('access_token');
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ username: state.username }),
    }
  )
);
