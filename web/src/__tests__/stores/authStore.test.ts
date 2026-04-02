import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from '@/stores/authStore';
import { act } from '@testing-library/react';
import type { AxiosResponse } from 'axios';

// AxiosResponseモックを作成するヘルパー
function mockAxiosResponse<T>(data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {} as AxiosResponse['config'],
  };
}

// authApiモック
vi.mock('@/api/auth', () => ({
  authApi: {
    login: vi.fn(),
    logout: vi.fn(),
    setup: vi.fn(),
    me: vi.fn(),
  },
}));

describe('authStore', () => {
  beforeEach(() => {
    // ストアをリセット
    useAuthStore.setState({
      isAuthenticated: false,
      username: null,
    });
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should have initial state', () => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.username).toBeNull();
  });

  it('should set authenticated state after login', async () => {
    const { authApi } = await import('@/api/auth');
    vi.mocked(authApi.login).mockResolvedValueOnce(
      mockAxiosResponse({ username: 'testuser' })
    );

    await act(async () => {
      await useAuthStore.getState().login('testuser', 'Password1');
    });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.username).toBe('testuser');
  });

  it('should clear state on logout', async () => {
    // ログイン状態をセット
    useAuthStore.setState({
      isAuthenticated: true,
      username: 'testuser',
    });

    const { authApi } = await import('@/api/auth');
    vi.mocked(authApi.logout).mockResolvedValueOnce(mockAxiosResponse({}));

    await act(async () => {
      await useAuthStore.getState().logout();
    });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.username).toBeNull();
  });

  it('should clear state on logout even if API fails', async () => {
    useAuthStore.setState({
      isAuthenticated: true,
      username: 'testuser',
    });

    const { authApi } = await import('@/api/auth');
    vi.mocked(authApi.logout).mockRejectedValueOnce(new Error('Network error'));

    await act(async () => {
      await useAuthStore.getState().logout();
    });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.username).toBeNull();
  });

  it('should check auth and set state when authenticated', async () => {
    const { authApi } = await import('@/api/auth');
    vi.mocked(authApi.me).mockResolvedValueOnce(
      mockAxiosResponse({ username: 'testuser' })
    );

    await act(async () => {
      const result = await useAuthStore.getState().checkAuth();
      expect(result).toBe(true);
    });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.username).toBe('testuser');
  });

  it('should check auth and clear state when not authenticated', async () => {
    useAuthStore.setState({
      isAuthenticated: true,
      username: 'testuser',
    });

    const { authApi } = await import('@/api/auth');
    vi.mocked(authApi.me).mockRejectedValueOnce(new Error('Unauthorized'));

    await act(async () => {
      const result = await useAuthStore.getState().checkAuth();
      expect(result).toBe(false);
    });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.username).toBeNull();
  });

  it('should setup and auto-login', async () => {
    const { authApi } = await import('@/api/auth');
    vi.mocked(authApi.setup).mockResolvedValueOnce(
      mockAxiosResponse({ user: { id: '1', username: 'newuser' } })
    );
    vi.mocked(authApi.login).mockResolvedValueOnce(
      mockAxiosResponse({ username: 'newuser' })
    );

    await act(async () => {
      await useAuthStore.getState().setup('newuser', 'Password1');
    });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.username).toBe('newuser');
    expect(authApi.setup).toHaveBeenCalledWith({ username: 'newuser', password: 'Password1' });
    expect(authApi.login).toHaveBeenCalledWith({ username: 'newuser', password: 'Password1' });
  });
});
