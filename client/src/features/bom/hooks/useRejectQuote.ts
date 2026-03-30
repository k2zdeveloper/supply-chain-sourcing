import { useState, useCallback } from 'react';
import { rejectQuote } from '../api'; // Adjust this import path as needed

interface UseRejectQuoteOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export const useRejectQuote = (options?: UseRejectQuoteOptions) => {
  const [isRejecting, setIsRejecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (quoteId: string) => {
    setIsRejecting(true);
    setError(null);
    
    try {
      await rejectQuote(quoteId);
      options?.onSuccess?.();
    } catch (err) {
      const parsedError = err instanceof Error ? err : new Error('An unknown error occurred');
      setError(parsedError);
      options?.onError?.(parsedError);
    } finally {
      setIsRejecting(false);
    }
  }, [options]);

  return { mutate, isRejecting, error };
};