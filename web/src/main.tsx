import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { AxiosError } from 'axios';
import App from './App';
import '@/theme/global.css';
import ErrorBoundary from '@/components/ErrorBoundary';
import { useAppTheme } from '@/theme/useAppTheme';
import { QUERY_STALE_TIME_MS } from '@/constants';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry on auth errors — the interceptor handles redirect to login
        if (error instanceof AxiosError && error.response?.status === 401) {
          return false;
        }
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
      staleTime: QUERY_STALE_TIME_MS,
    },
    mutations: {
      // Never auto-retry mutations to prevent duplicate operations
      retry: false,
    },
  },
});

function Root() {
  const theme = useAppTheme();
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ErrorBoundary>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <Root />
    </QueryClientProvider>
  </React.StrictMode>,
);
