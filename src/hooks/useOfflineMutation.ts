import { useCallback } from 'react';
import useOffline from '../stores/offlineStore';
import useOnlineStatus from './useOnlineStatus';
import { useToast } from './useToast';
import { CLIENT_ID_META, CLIENT_ID_TYPES } from '../utils/offlineCreates';
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
  onSuccess?: (result: T) => void | Promise<void>;
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
        const data = CLIENT_ID_TYPES.includes(operationType)
          ? {
              ...queueData,
              meta_data: [
                ...((queueData.meta_data as unknown[]) ?? []),
                { key: CLIENT_ID_META, value: crypto.randomUUID() },
              ],
            }
          : queueData;
        addPendingOperation(operationType, data, storeId);
        showToast('You are offline. This change will sync when you reconnect.', 'warning');
        return { queued: true, success: false };
      }

      try {
        const result = await execute();
        await onSuccess?.(result);
        return { queued: false, success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Operation failed';
        onError?.(message);
        return { queued: false, success: false, error: message };
      }
    },
    [isOnline, addPendingOperation, showToast]
  );

  /** Queue-or-run an ApiResponse-returning call (the service layer returns, never throws). */
  const mutateApi = useCallback(
    (
      operationType: PendingOperationType,
      queueData: Record<string, unknown>,
      storeId: string,
      call: () => Promise<{ success: boolean; error?: string }>,
      onError?: (error: string) => void,
      fallback = 'Operation failed'
    ) =>
      mutate({
        operationType,
        queueData,
        storeId,
        execute: async () => {
          const r = await call();
          if (!r.success) throw new Error(r.error || fallback);
        },
        onError,
      }),
    [mutate]
  );

  return { mutate, mutateApi, isOnline };
}
