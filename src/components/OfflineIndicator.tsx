import React, { useState, useEffect, useCallback } from 'react';
import { WifiOff, RefreshCw, AlertCircle, Check, Clock } from 'lucide-react';
import useOffline from '../stores/offlineStore';
import useOnlineStatus from '../hooks/useOnlineStatus';
import { useStoreConfig } from '../stores';
import WooCommerceService from '../services/woocommerce';
import type { PendingOperation } from '../types';

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
  const getCurrentStore = useStoreConfig((state) => state.getCurrentStore);

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncProgress, setSyncProgress] = useState<number>(0);
  const [showDetails, setShowDetails] = useState<boolean>(false);

  const currentStore = getCurrentStore();
  const hasPendingOps = pendingOperations.length > 0;

  // Process a single pending operation
  const processOperation = useCallback(
    async (operation: PendingOperation): Promise<boolean> => {
      if (!currentStore || currentStore.id !== operation.storeId) {
        return false;
      }

      const service = new WooCommerceService(currentStore);
      let result: { success: boolean; error?: string };

      try {
        switch (operation.type) {
          case 'create_order':
            result = await service.createOrder(operation.data);
            break;
          case 'update_order':
            result = await service.updateOrder(
              operation.data.id as number,
              operation.data as Record<string, unknown>
            );
            break;
          case 'update_product':
            result = await service.updateProduct(
              operation.data.id as number,
              operation.data as Record<string, unknown>
            );
            break;
          case 'update_stock':
            result = await service.updateStock(
              operation.data.productId as number,
              operation.data.quantity as number,
              operation.data.stockStatus as 'instock' | 'outofstock' | 'onbackorder'
            );
            break;
          case 'create_coupon':
            result = await service.createCoupon(operation.data);
            break;
          case 'update_coupon':
            result = await service.updateCoupon(
              operation.data.id as number,
              operation.data as Record<string, unknown>
            );
            break;
          case 'delete_coupon':
            result = await service.deleteCoupon(operation.data.id as number);
            break;
          default:
            result = { success: false, error: 'Unknown operation type' };
        }

        return result.success;
      } catch (error) {
        updatePendingOperation(operation.id, {
          lastError: error instanceof Error ? error.message : 'Unknown error',
        });
        return false;
      }
    },
    [currentStore, updatePendingOperation]
  );

  // Sync all pending operations
  const syncPendingOperations = useCallback(async (): Promise<void> => {
    if (!isOnline || pendingOperations.length === 0 || isSyncing) {
      return;
    }

    setIsSyncing(true);
    setSyncProgress(0);
    setLastSyncAttempt(Date.now());

    const total = pendingOperations.length;
    let processed = 0;

    for (const operation of pendingOperations) {
      const success = await processOperation(operation);

      if (success) {
        removePendingOperation(operation.id);
      } else {
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
    pendingOperations,
    isSyncing,
    processOperation,
    removePendingOperation,
    incrementRetryCount,
    setLastSyncAttempt,
  ]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && hasPendingOps && !isSyncing) {
      // Delay a bit to ensure connectivity is stable
      const timeoutId = setTimeout(() => {
        syncPendingOperations();
      }, 2000);

      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [isOnline, hasPendingOps, isSyncing, syncPendingOperations]);

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
            <span className="font-medium">Offline</span>
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
                      {op.lastError && (
                        <p className="text-xs text-red-500 mt-1 truncate">{op.lastError}</p>
                      )}
                    </div>
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
