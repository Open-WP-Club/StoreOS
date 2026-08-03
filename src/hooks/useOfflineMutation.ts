import { useCallback } from 'react';
import useOffline from '../stores/offlineStore';
import useOnlineStatus from './useOnlineStatus';
import { useToast } from './useToast';
import type { PendingOperationType } from '../types';

interface MutationOptions<T> {
  /** Operation type for offline queue */
  operationType: PendingOperationType;
  /** Data to persist in the queue if offline */
  queueData: Record<string, unknown>;
  /** Store ID for queue tracking */
  storeId: string;
  /** The actual API call to execute when online */
  execute: () => Promise<T>;
  /** Called on successful execution */
  onSuccess?: (result: T) => void;
  /** Called on failed execution (still online) */
  onError?: (error: string) => void;
}

interface MutationResult {
  queued: boolean;
  success: boolean;
  error?: string;
}

/**
 * Hook for mutations that should be queued when offline and replayed on reconnect.
 *
 * When online: executes immediately, calls onSuccess/onError.
 * When offline: queues the operation and shows a toast — OfflineIndicator replays it.
 */
export function useOfflineMutation() {
  const { isOnline } = useOnlineStatus();
  const addPendingOperation = useOffline((state) => state.addPendingOperation);
  const { showToast } = useToast();

  const mutate = useCallback(
    async <T>(options: MutationOptions<T>): Promise<MutationResult> => {
      const { operationType, queueData, storeId, execute, onSuccess, onError } = options;

      if (!isOnline) {
        addPendingOperation(operationType, queueData, storeId);
        showToast('You are offline. This change will sync when you reconnect.', 'warning');
        return { queued: true, success: false };
      }

      try {
        const result = await execute();
        onSuccess?.(result);
        return { queued: false, success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Operation failed';
        onError?.(message);
        return { queued: false, success: false, error: message };
      }
    },
    [isOnline, addPendingOperation, showToast]
  );

  return { mutate, isOnline };
}
