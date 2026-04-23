import { useEffect, useMemo } from 'react';
import { useMediaQuery } from '@mui/material';
import { useUiStore } from '@/stores/uiStore';
import { lightTheme, darkTheme } from './theme';

export function useAppTheme() {
  const themeMode = useUiStore((state) => state.themeMode);
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');

  const isDark = themeMode === 'system' ? prefersDark : themeMode === 'dark';

  const theme = useMemo(() => (isDark ? darkTheme : lightTheme), [isDark]);

  useEffect(() => {
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  }, [isDark]);

  return theme;
}
