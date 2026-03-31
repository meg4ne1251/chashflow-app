import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi } from '@/api/auth';

interface AuthState {
  isAuthenticated: boolean;
  username: string | null;
  login: (username: string, password: string) => Promise<void>;
  setup: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<boolean>;  // 戻り値型を boolean から Promise<boolean> に変更
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      username: null,

      login: async (username: string, password: string) => {
        // トークンはCookieで自動管理されるため、localStorageへの保存は不要
        await authApi.login({ username, password });
        set({ isAuthenticated: true, username });
      },

      setup: async (username: string, password: string) => {
        await authApi.setup({ username, password });
        // After setup, auto-login
        await authApi.login({ username, password });
        set({ isAuthenticated: true, username });
      },

      logout: async () => {
        try {
          // 引数なしで呼び出し（Cookie化により refresh_token は不要）
          await authApi.logout();
        } catch {
          // Ignore logout errors
        } finally {
          // サーバー側でCookie削除を行う
          set({ isAuthenticated: false, username: null });
        }
      },

      // サーバーに問い合わせて認証状態を確認（同期→非同期に変更）
      checkAuth: async () => {
        try {
          const response = await authApi.me();
          set({ isAuthenticated: true, username: response.data.username });
          return true;
        } catch {
          set({ isAuthenticated: false, username: null });
          return false;
        }
      },
    }),
    {
      name: 'auth-storage',
      // usernameのみ永続化（トークンは保存しない）
      partialize: (state) => ({ username: state.username }),
      onRehydrateStorage: () => (state) => {
        // 初期化時は認証状態をfalseに設定
        // 実際の認証確認はcheckAuth()で行う
        if (state) {
          state.isAuthenticated = false;
        }
      },
    }
  )
);
