import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useUiStore } from '@/stores/uiStore';
import { act } from '@testing-library/react';

describe('uiStore', () => {
  beforeEach(() => {
    // ストアをリセット
    useUiStore.setState({
      themeMode: 'system',
      sidebarOpen: true,
    });
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have default theme mode as system', () => {
      const state = useUiStore.getState();
      expect(state.themeMode).toBe('system');
    });

    it('should have sidebar open by default', () => {
      const state = useUiStore.getState();
      expect(state.sidebarOpen).toBe(true);
    });
  });

  describe('setThemeMode', () => {
    it('should set theme mode to light', () => {
      act(() => {
        useUiStore.getState().setThemeMode('light');
      });

      const state = useUiStore.getState();
      expect(state.themeMode).toBe('light');
    });

    it('should set theme mode to dark', () => {
      act(() => {
        useUiStore.getState().setThemeMode('dark');
      });

      const state = useUiStore.getState();
      expect(state.themeMode).toBe('dark');
    });

    it('should set theme mode to system', () => {
      // まずdarkに設定
      useUiStore.setState({ themeMode: 'dark' });

      act(() => {
        useUiStore.getState().setThemeMode('system');
      });

      const state = useUiStore.getState();
      expect(state.themeMode).toBe('system');
    });
  });

  describe('toggleSidebar', () => {
    it('should toggle sidebar from open to closed', () => {
      expect(useUiStore.getState().sidebarOpen).toBe(true);

      act(() => {
        useUiStore.getState().toggleSidebar();
      });

      expect(useUiStore.getState().sidebarOpen).toBe(false);
    });

    it('should toggle sidebar from closed to open', () => {
      useUiStore.setState({ sidebarOpen: false });

      act(() => {
        useUiStore.getState().toggleSidebar();
      });

      expect(useUiStore.getState().sidebarOpen).toBe(true);
    });

    it('should toggle multiple times', () => {
      act(() => {
        useUiStore.getState().toggleSidebar();
        useUiStore.getState().toggleSidebar();
        useUiStore.getState().toggleSidebar();
      });

      // true -> false -> true -> false
      expect(useUiStore.getState().sidebarOpen).toBe(false);
    });
  });

  describe('setSidebarOpen', () => {
    it('should set sidebar to open', () => {
      useUiStore.setState({ sidebarOpen: false });

      act(() => {
        useUiStore.getState().setSidebarOpen(true);
      });

      expect(useUiStore.getState().sidebarOpen).toBe(true);
    });

    it('should set sidebar to closed', () => {
      act(() => {
        useUiStore.getState().setSidebarOpen(false);
      });

      expect(useUiStore.getState().sidebarOpen).toBe(false);
    });

    it('should not change if setting same value', () => {
      expect(useUiStore.getState().sidebarOpen).toBe(true);

      act(() => {
        useUiStore.getState().setSidebarOpen(true);
      });

      expect(useUiStore.getState().sidebarOpen).toBe(true);
    });
  });

  describe('persistence', () => {
    it('should persist state to localStorage', () => {
      act(() => {
        useUiStore.getState().setThemeMode('dark');
        useUiStore.getState().setSidebarOpen(false);
      });

      // localStorage に保存されることを確認
      const stored = localStorage.getItem('ui-storage');
      expect(stored).toBeTruthy();
      
      if (stored) {
        const parsed = JSON.parse(stored);
        expect(parsed.state.themeMode).toBe('dark');
        expect(parsed.state.sidebarOpen).toBe(false);
      }
    });
  });
});
