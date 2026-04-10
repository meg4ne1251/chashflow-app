import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi } from '@/api/auth';
import { logger } from '@/utils/logger';

/**
 * 認証状態を管理するZustandストア
 *
 * ログイン、ログアウト、セットアップの状態管理を行います。
 * トークンはhttpOnly Cookieで管理され、usernameのみlocalStorageに永続化されます。
 *
 * @example
 * ```tsx
 * const { isAuthenticated, login, logout } = useAuthStore();
 *
 * if (!isAuthenticated) {
 *   await login('username', 'password');
 * }
 * ```
 */
interface AuthState {
  /** ユーザーが認証済みかどうか */
  isAuthenticated: boolean;
  /** ログイン中のユーザー名（未認証時はnull） */
  username: string | null;
  /**
   * ログインを実行
   * @throws 認証失敗時にエラーをスロー
   */
  login: (username: string, password: string) => Promise<void>;
  /**
   * 初期セットアップを実行（初回起動時のみ）
   */
  setup: (username: string, password: string) => Promise<void>;
  /**
   * ログアウトを実行。トークンを破棄し、他タブにも通知します
   */
  logout: () => Promise<void>;
  /**
   * サーバーに問い合わせて現在の認証状態を確認
   * @returns 認証済みならtrue
   */
  checkAuth: () => Promise<boolean>;
  /**
   * 認証状態を直接設定（タブ間同期用）
   */
  setAuthenticated: (value: boolean) => void;
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
          await authApi.logout();
        } catch (err) {
          // サーバー側logout (トークン無効化) が失敗しても、
          // クライアント側の状態クリアは必ず行う。
          // デバッグ性のためエラーは warn に出す (サイレントに握りつぶさない)。
          logger.warn('Logout API call failed; clearing client state anyway', err);
        } finally {
          broadcastLogout();
          set({ isAuthenticated: false, username: null });
        }
      },

      setAuthenticated: (value: boolean) => {
        set({ isAuthenticated: value });
        if (!value) {
          set({ username: null });
        }
      },

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

function broadcastLogout() {
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel('auth-sync');
    channel.postMessage({ type: 'LOGOUT' });
    channel.close();
  }
}
