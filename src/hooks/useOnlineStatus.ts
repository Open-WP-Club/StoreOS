import { useState, useEffect, useCallback, useRef } from 'react';
import useOffline from '../stores/offlineStore';

/**
 * Hook to monitor online/offline status
 * Updates the offline store and provides reactive status
 */
export function useOnlineStatus(): {
  isOnline: boolean;
  checkStatus: () => Promise<boolean>;
} {
  const setOnline = useOffline((state) => state.setOnline);
  const checkOnlineStatus = useOffline((state) => state.checkOnlineStatus);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const hasSyncedRef = useRef(false);

  const handleOnline = useCallback(() => {
    setIsOnline(true);
    setOnline(true);
  }, [setOnline]);

  const handleOffline = useCallback(() => {
    setIsOnline(false);
    setOnline(false);
  }, [setOnline]);

  // Listen to browser online/offline events
  useEffect(() => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial sync of the external offline store (once per mount only)
    if (!hasSyncedRef.current) {
      hasSyncedRef.current = true;
      setOnline(navigator.onLine);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleOnline, handleOffline, setOnline]);

  const checkStatus = useCallback(async (): Promise<boolean> => {
    const online = await checkOnlineStatus();
    setIsOnline(online);
    return online;
  }, [checkOnlineStatus]);

  return { isOnline, checkStatus };
}

export default useOnlineStatus;
