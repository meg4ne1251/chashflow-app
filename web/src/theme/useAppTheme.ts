import { useMemo } from 'react';
import { useMediaQuery } from '@mui/material';
import { useUiStore } from '@/stores/uiStore';
import { lightTheme, darkTheme } from './theme';

export function useAppTheme() {
  const themeMode = useUiStore((state) => state.themeMode);
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');

  const theme = useMemo(() => {
    if (themeMode === 'system') {
      return prefersDark ? darkTheme : lightTheme;
    }
    return themeMode === 'dark' ? darkTheme : lightTheme;
  }, [themeMode, prefersDark]);

  return theme;
}
