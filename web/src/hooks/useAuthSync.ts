import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

/**
 * Sync authentication state across browser tabs via BroadcastChannel API.
 * When one tab logs out, all other tabs are redirected to the login page.
 */
export function useAuthSync() {
  const setAuthenticated = useAuthStore((state) => state.setAuthenticated);
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') {
      return;
    }

    const channel = new BroadcastChannel('auth-sync');

    channel.onmessage = (event) => {
      if (event.data.type === 'LOGOUT') {
        setAuthenticated(false);
        navigate('/login', { replace: true });
      }
    };

    return () => {
      channel.close();
    };
  }, [setAuthenticated, navigate]);
}
