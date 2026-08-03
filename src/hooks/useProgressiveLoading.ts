import { useState, useCallback, useRef } from 'react';

/**
 * Loading state for progressive data loading
 */
export interface LoadingState {
  isLoading: boolean;
  loaded: number;
  total: number;
  progress: number;
  dataType: 'orders' | 'products' | '';
}

/**
 * Return type for useProgressiveLoading hook
 */
export interface UseProgressiveLoadingReturn {
  loadingState: LoadingState;
  startLoading: (dataType: 'orders' | 'products', total?: number) => void;
  updateProgress: (loaded: number, total: number) => void;
  finishLoading: () => void;
  cancelLoading: () => void;
  isCancelled: () => boolean;
}

/**
 * Custom hook for progressive/incremental data loading
 * Loads data in batches with configurable delays, allowing users to interact
 * with partial data while loading continues in the background
 */
export function useProgressiveLoading(): UseProgressiveLoadingReturn {
  const [loadingState, setLoadingState] = useState<LoadingState>({
    isLoading: false,
    loaded: 0,
    total: 0,
    progress: 0,
    dataType: '',
  });

  const cancelRef = useRef<boolean>(false);

  const startLoading = useCallback((dataType: 'orders' | 'products', total: number = 0) => {
    cancelRef.current = false;
    setLoadingState({
      isLoading: true,
      loaded: 0,
      total,
      progress: 0,
      dataType,
    });
  }, []);

  const updateProgress = useCallback((loaded: number, total: number) => {
    if (cancelRef.current) return;

    const progress = total > 0 ? Math.round((loaded / total) * 100) : 0;
    setLoadingState((prev) => ({
      ...prev,
      loaded,
      total,
      progress,
    }));
  }, []);

  const finishLoading = useCallback(() => {
    setLoadingState((prev) => ({
      ...prev,
      isLoading: false,
      progress: 100,
    }));
  }, []);

  const cancelLoading = useCallback(() => {
    cancelRef.current = true;
    setLoadingState((prev) => ({
      ...prev,
      isLoading: false,
    }));
  }, []);

  return {
    loadingState,
    startLoading,
    updateProgress,
    finishLoading,
    cancelLoading,
    isCancelled: useCallback(() => cancelRef.current, []),
  };
}

/**
 * Sleep utility for adding delays between batches
 */
export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
