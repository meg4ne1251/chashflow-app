import { useState, useCallback } from 'react';

/**
 * Custom hook for consistent error handling across components.
 * Provides error state management and standardized error handling.
 */
export const useErrorHandler = () => {
  const [error, setError] = useState<string | null>(null);

  const handleError = useCallback((message?: string, err?: unknown) => {
    const errorMessage = message || 'エラーが発生しました';
    setError(errorMessage);
    
    // Log to console for debugging (in production, this could send to monitoring service)
    if (err) {
      console.error(errorMessage, err);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return { error, setError, handleError, clearError };
};
