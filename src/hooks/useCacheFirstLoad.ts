import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStoreConfig } from '../stores';

interface UseCacheFirstLoadOptions<T> {
  /** Try to find the item in cache by ID */
  getFromCache: () => T | null;
  /** Fetch fresh data from API */
  fetchFromApi: (showLoading: boolean) => Promise<T | null>;
  /** Called when data is available (from cache or API) */
  onData: (data: T) => void;
  /** Route ID parameter (triggers reload on change) */
  id: string | undefined;
}

interface UseCacheFirstLoadResult<T> {
  data: T | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  setData: (data: T | null) => void;
  setError: (error: string | null) => void;
}

/**
 * Generic hook implementing cache-first loading pattern:
 * 1. Check cache for instant display
 * 2. Fetch fresh data from API in background
 * 3. Handle loading/error states
 */
export function useCacheFirstLoad<T>({
  getFromCache,
  fetchFromApi,
  onData,
  id,
}: UseCacheFirstLoadOptions<T>): UseCacheFirstLoadResult<T> {
  const navigate = useNavigate();
  const getCurrentStore = useStoreConfig((state) => state.getCurrentStore);
  const currentStore = getCurrentStore();

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const dataRef = useRef<T | null>(null);

  const fetchData = useCallback(
    async (showLoadingState: boolean): Promise<void> => {
      try {
        if (showLoadingState) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }
        setError(null);

        const result = await fetchFromApi(showLoadingState);

        if (result) {
          setData(result);
          dataRef.current = result;
          onData(result);
        } else if (!dataRef.current) {
          setError('Failed to load data');
        }
      } catch (err) {
        if (!dataRef.current) {
          setError((err as Error).message || 'Failed to load data');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fetchFromApi, onData]
  );

  // getFromCache/fetchData/onData come from the caller and are typically not
  // memoized, so we read the latest versions via a ref instead of listing
  // them as effect deps (which would re-run the effect on every render).
  const latestRef = useRef({ getFromCache, fetchData, onData });
  useEffect(() => {
    latestRef.current = { getFromCache, fetchData, onData };
  });

  useEffect(() => {
    if (!currentStore) {
      navigate('/setup');
      return;
    }

    const cachedItem = latestRef.current.getFromCache();

    // Defer to a microtask so no setState (direct or via fetchData) runs
    // synchronously within the effect body; ordering/behavior is unchanged.
    Promise.resolve().then(() => {
      if (cachedItem) {
        setData(cachedItem);
        dataRef.current = cachedItem;
        latestRef.current.onData(cachedItem);
        setLoading(false);
        latestRef.current.fetchData(false);
      } else {
        latestRef.current.fetchData(true);
      }
    });
  }, [id, currentStore, navigate]);

  return { data, loading, refreshing, error, setData, setError };
}

export default useCacheFirstLoad;
