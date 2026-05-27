/**
 * useNotifications フックのテスト。
 *
 * notificationApi と authStore をモックし、react-query の挙動
 * （認証時のみ取得 / select による unwrap / mutation 後の invalidate）を検証する。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useNotifications } from '@/hooks/useNotifications';

const { authState } = vi.hoisted(() => ({ authState: { isAuthenticated: true } }));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: { isAuthenticated: boolean }) => unknown) => selector(authState),
}));

vi.mock('@/api/notifications', () => ({
  notificationApi: {
    getUnread: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
  },
}));

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

const unreadPayload = (count: number) => ({
  data: {
    notifications: Array.from({ length: count }, (_, i) => ({ id: `n${i + 1}` })),
    unread_count: count,
  },
});

describe('useNotifications', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    authState.isAuthenticated = true;
  });

  it('exposes notifications and unread count when authenticated', async () => {
    const { notificationApi } = await import('@/api/notifications');
    vi.mocked(notificationApi.getUnread).mockResolvedValue(unreadPayload(2) as never);

    const { result } = renderHook(() => useNotifications(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.unreadCount).toBe(2));
    expect(result.current.notifications).toHaveLength(2);
    expect(notificationApi.getUnread).toHaveBeenCalled();
  });

  it('does not fetch when unauthenticated and returns empty defaults', async () => {
    authState.isAuthenticated = false;
    const { notificationApi } = await import('@/api/notifications');
    vi.mocked(notificationApi.getUnread).mockResolvedValue(unreadPayload(5) as never);

    const { result } = renderHook(() => useNotifications(), { wrapper: makeWrapper() });

    // クエリが disabled のため取得は呼ばれず、デフォルト値のまま
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(notificationApi.getUnread).not.toHaveBeenCalled();
    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
  });

  it('markAsRead calls the API and refetches the unread list', async () => {
    const { notificationApi } = await import('@/api/notifications');
    vi.mocked(notificationApi.getUnread).mockResolvedValue(unreadPayload(1) as never);
    vi.mocked(notificationApi.markAsRead).mockResolvedValue({} as never);

    const { result } = renderHook(() => useNotifications(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.unreadCount).toBe(1));
    const initialFetches = vi.mocked(notificationApi.getUnread).mock.calls.length;

    act(() => result.current.markAsRead('n1'));

    await waitFor(() => expect(notificationApi.markAsRead).toHaveBeenCalledWith('n1'));
    // onSuccess の invalidateQueries により再取得される
    await waitFor(() =>
      expect(vi.mocked(notificationApi.getUnread).mock.calls.length).toBeGreaterThan(initialFetches),
    );
  });

  it('markAllAsRead calls the API', async () => {
    const { notificationApi } = await import('@/api/notifications');
    vi.mocked(notificationApi.getUnread).mockResolvedValue(unreadPayload(3) as never);
    vi.mocked(notificationApi.markAllAsRead).mockResolvedValue({} as never);

    const { result } = renderHook(() => useNotifications(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.unreadCount).toBe(3));
    act(() => result.current.markAllAsRead());

    await waitFor(() => expect(notificationApi.markAllAsRead).toHaveBeenCalled());
  });
});
