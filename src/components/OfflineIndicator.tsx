import React, { useState, useEffect, useCallback } from 'react';
import { WifiOff, RefreshCw, AlertCircle, Check, Clock } from 'lucide-react';
import useOffline from '../stores/offlineStore';
import useOnlineStatus from '../hooks/useOnlineStatus';
import { useStoreConfig } from '../stores';
import WooCommerceService from '../services/woocommerce';
import { resolvePendingSale } from '../utils/posOfflineSale';
import { replayOperation } from '../utils/offlineReplay';
import { editedFields, stockDeltaData } from '../utils/offlineConflicts';
import type { PendingOperation } from '../types';

function ConflictPanel({
  op,
  disabled,
  onKeepMine,
  onUseServer,
  onApplyDelta,
}: {
  op: PendingOperation;
  disabled: boolean;
  onKeepMine: () => void;
  onUseServer: () => void;
  onApplyDelta: () => void;
}): React.ReactElement | null {
  const c = op.conflict;
  if (!c) return null;
  const mine = editedFields(op);
  const show = (v: unknown): string => (typeof v === 'string' ? v : JSON.stringify(v ?? null));
  const btn =
    'px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-500 text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50';
  return (
    <div className="mt-1 space-y-1" data-testid="conflict-panel">
      <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
        Changed on the server while you were offline
      </p>
      <table className="w-full text-xs text-gray-700 dark:text-gray-200">
        <thead>
          <tr className="text-left text-gray-500 dark:text-gray-400">
            <th className="font-normal">Field</th>
            <th className="font-normal">Mine</th>
            <th className="font-normal">Server</th>
          </tr>
        </thead>
        <tbody>
          {c.fields.map((f) => (
            <tr key={f}>
              <td>{f}</td>
              <td>{show(mine[f])}</td>
              <td>{show(c.server[f])}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap gap-1">
        <button className={btn} disabled={disabled} onClick={onKeepMine}>
          Keep mine
        </button>
        <button className={btn} onClick={onUseServer}>
          Use server
        </button>
        {stockDeltaData(op) && (
          <button className={btn} disabled={disabled} onClick={onApplyDelta}>
            Apply as delta ({c.stockDelta! > 0 ? '+' : ''}
            {c.stockDelta})
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * OfflineIndicator
 *
 * Displays offline status and pending operations count.
 * Allows manual sync when back online.
 */
function OfflineIndicator(): React.ReactElement | null {
  const { isOnline, checkStatus } = useOnlineStatus();
  const pendingOperations = useOffline((state) => state.pendingOperations);
  const removePendingOperation = useOffline((state) => state.removePendingOperation);
  const incrementRetryCount = useOffline((state) => state.incrementRetryCount);
  const updatePendingOperation = useOffline((state) => state.updatePendingOperation);
  const setLastSyncAttempt = useOffline((state) => state.setLastSyncAttempt);
  const stores = useStoreConfig((state) => state.stores);

  const discardOperation = (op: PendingOperation): void => {
    if (typeof op.data.clientId === 'string') resolvePendingSale(op.data.clientId, null);
    removePendingOperation(op.id);
  };

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncProgress, setSyncProgress] = useState<number>(0);
  const [showDetails, setShowDetails] = useState<boolean>(false);

  // Conflicted ops wait for the user's choice; they are never auto-synced.
  const syncable = pendingOperations.filter((op) => !op.conflict);
  const hasPendingOps = pendingOperations.length > 0;
  const hasSyncableOps = syncable.length > 0;

  // Process a single pending operation
  const processOperation = useCallback(
    async (operation: PendingOperation): Promise<boolean | 'conflict'> => {
      // Replay against the operation's own store (may differ from the current one).
      const store = stores.find((s) => s.id === operation.storeId);
      if (!store) return false;

      try {
        const result = await replayOperation(new WooCommerceService(store), operation);

        if (result.conflict) {
          updatePendingOperation(operation.id, {
            conflict: result.conflict,
            lastError: 'Changed on the server',
          });
          return 'conflict';
        }
        if (!result.success) {
          updatePendingOperation(operation.id, { lastError: result.error ?? 'Sync failed' });
        }
        return result.success;
      } catch (error) {
        updatePendingOperation(operation.id, {
          lastError: error instanceof Error ? error.message : 'Unknown error',
        });
        return false;
      }
    },
    [stores, updatePendingOperation]
  );

  // Resolve a held conflict: send the op (optionally rewritten) with no snapshot, so no re-check.
  const sendResolved = async (
    op: PendingOperation,
    data?: Record<string, unknown>
  ): Promise<void> => {
    const next: PendingOperation = {
      ...op,
      data: data ?? op.data,
      conflict: undefined,
      base: undefined,
    };
    updatePendingOperation(op.id, {
      data: next.data,
      conflict: undefined,
      base: undefined,
      lastError: undefined,
    });
    if ((await processOperation(next)) === true) removePendingOperation(op.id);
  };

  // Sync all pending operations
  const syncPendingOperations = useCallback(async (): Promise<void> => {
    if (!isOnline || !hasSyncableOps || isSyncing) {
      return;
    }

    setIsSyncing(true);
    setSyncProgress(0);
    setLastSyncAttempt(Date.now());

    const total = syncable.length;
    let processed = 0;

    for (const operation of syncable) {
      const success = await processOperation(operation);

      if (success === true) {
        removePendingOperation(operation.id);
      } else if (success === false) {
        incrementRetryCount(operation.id);
      }

      processed++;
      setSyncProgress(Math.round((processed / total) * 100));

      // Small delay between operations
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    setIsSyncing(false);
    setSyncProgress(0);
  }, [
    isOnline,
    syncable,
    hasSyncableOps,
    isSyncing,
    processOperation,
    removePendingOperation,
    incrementRetryCount,
    setLastSyncAttempt,
  ]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && hasSyncableOps && !isSyncing) {
      // Delay a bit to ensure connectivity is stable
      const timeoutId = setTimeout(() => {
        syncPendingOperations();
      }, 2000);

      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [isOnline, hasSyncableOps, isSyncing, syncPendingOperations]);

  // Don't show anything if online and no pending operations
  if (isOnline && !hasPendingOps) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-40">
      {/* Main indicator button */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg transition-all ${
          !isOnline
            ? 'bg-red-600 text-white hover:bg-red-700'
            : hasPendingOps
              ? 'bg-yellow-500 text-white hover:bg-yellow-600'
              : 'bg-green-600 text-white hover:bg-green-700'
        }`}
      >
        {!isOnline ? (
          <>
            <WifiOff className="w-5 h-5" />
            <span className="font-medium">
              Offline{hasPendingOps && ` · ${pendingOperations.length} pending`}
            </span>
          </>
        ) : isSyncing ? (
          <>
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span className="font-medium">Syncing... {syncProgress}%</span>
          </>
        ) : hasPendingOps ? (
          <>
            <Clock className="w-5 h-5" />
            <span className="font-medium">{pendingOperations.length} pending</span>
          </>
        ) : (
          <>
            <Check className="w-5 h-5" />
            <span className="font-medium">Synced</span>
          </>
        )}
      </button>

      {/* Details panel */}
      {showDetails && (
        <div className="absolute bottom-full right-0 mb-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">Sync Status</h3>
              <div
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                  isOnline
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}
                />
                {isOnline ? 'Online' : 'Offline'}
              </div>
            </div>
          </div>

          <div className="p-4 max-h-60 overflow-y-auto">
            {pendingOperations.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                No pending operations
              </p>
            ) : (
              <div className="space-y-2">
                {pendingOperations.map((op) => (
                  <div
                    key={op.id}
                    className="flex items-start gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {op.retryCount >= 3 ? (
                        <AlertCircle className="w-4 h-4 text-red-500" />
                      ) : (
                        <Clock className="w-4 h-4 text-yellow-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {op.type.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(op.timestamp).toLocaleTimeString()}
                        {op.retryCount > 0 && ` (${op.retryCount} retries)`}
                      </p>
                      {op.conflict ? (
                        <ConflictPanel
                          op={op}
                          disabled={!isOnline}
                          onKeepMine={() => void sendResolved(op)}
                          onUseServer={() => removePendingOperation(op.id)}
                          onApplyDelta={() => {
                            const data = stockDeltaData(op);
                            if (data) void sendResolved(op, data);
                          }}
                        />
                      ) : (
                        op.lastError && (
                          <p className="text-xs text-red-500 mt-1 truncate">{op.lastError}</p>
                        )
                      )}
                    </div>
                    {op.retryCount > 0 && !op.conflict && (
                      <button
                        onClick={() => discardOperation(op)}
                        className="text-xs text-red-600 dark:text-red-400 hover:underline"
                      >
                        Discard
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {hasPendingOps && isOnline && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={syncPendingOperations}
                disabled={isSyncing}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </button>
            </div>
          )}

          {!isOnline && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={checkStatus}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Check Connection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default OfflineIndicator;
