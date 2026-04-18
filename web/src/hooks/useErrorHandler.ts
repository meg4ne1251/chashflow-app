import { useState, useCallback } from 'react';
import { logger } from '@/utils/logger';

/**
 * Custom hook for consistent error handling across components.
 * Provides error state management and standardized error handling.
 */
export const useErrorHandler = () => {
  const [error, setError] = useState<string | null>(null);

  const handleError = useCallback((message?: string, err?: unknown) => {
    const errorMessage = message || 'エラーが発生しました';
    setError(errorMessage);

    if (err) {
      logger.error(errorMessage, err);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return { error, setError, handleError, clearError };
};
