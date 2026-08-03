import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { PendingOperation, PendingOperationType, OfflineState } from '../types';
import { nowMs } from './storeUtils';

// ============================================
// Types
// ============================================

type OfflineStoreState = OfflineState;

interface OfflineStoreActions {
  // Online/offline status
  setOnline: (isOnline: boolean) => void;
  checkOnlineStatus: () => Promise<boolean>;

  // Pending operations
  addPendingOperation: (
    type: PendingOperationType,
    data: Record<string, unknown>,
    storeId: string
  ) => string;
  removePendingOperation: (id: string) => void;
  updatePendingOperation: (id: string, updates: Partial<PendingOperation>) => void;
  getPendingOperations: (storeId?: string) => PendingOperation[];
  clearPendingOperations: (storeId?: string) => void;

  // Sync
  setLastSyncAttempt: (timestamp: number) => void;
  incrementRetryCount: (id: string) => void;
  getFailedOperations: () => PendingOperation[];
}

type OfflineStore = OfflineStoreState & OfflineStoreActions;

// ============================================
// Constants
// ============================================

const MAX_RETRY_COUNT = 3;

// ============================================
// Helpers
// ============================================


// ============================================
// Store
// ============================================

/**
 * Offline Store
 *
 * Manages offline state and pending operations for sync when back online.
 * Operations are persisted to localStorage to survive page refreshes.
 */
const useOffline = create<OfflineStore>()(
  persist(
    immer((set, get) => ({
      // Initial state
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      pendingOperations: [],
      lastSyncAttempt: null,

      // ============================================
      // Online/Offline Status
      // ============================================

      setOnline: (isOnline: boolean) => {
        set({ isOnline });
      },

      checkOnlineStatus: async (): Promise<boolean> => {
        // First check navigator.onLine
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          set({ isOnline: false });
          return false;
        }

        // Try a lightweight request to verify actual connectivity
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);

          await fetch('https://www.google.com/favicon.ico', {
            method: 'HEAD',
            mode: 'no-cors',
            signal: controller.signal,
          });

          clearTimeout(timeoutId);
          set({ isOnline: true });
          return true;
        } catch {
          set({ isOnline: false });
          return false;
        }
      },

      // ============================================
      // Pending Operations
      // ============================================

      addPendingOperation: (
        type: PendingOperationType,
        data: Record<string, unknown>,
        storeId: string
      ): string => {
        const id = crypto.randomUUID();
        const operation: PendingOperation = {
          id,
          type,
          data,
          storeId,
          timestamp: nowMs(),
          retryCount: 0,
        };

        set((state) => {
          state.pendingOperations.push(operation);
        });

        return id;
      },

      removePendingOperation: (id: string) => {
        set((state) => {
          const index = state.pendingOperations.findIndex((op) => op.id === id);
          if (index !== -1) state.pendingOperations.splice(index, 1);
        });
      },

      updatePendingOperation: (id: string, updates: Partial<PendingOperation>) => {
        set((state) => {
          const op = state.pendingOperations.find((op) => op.id === id);
          if (op) Object.assign(op, updates);
        });
      },

      getPendingOperations: (storeId?: string): PendingOperation[] => {
        const operations = get().pendingOperations;
        if (storeId) {
          return operations.filter((op) => op.storeId === storeId);
        }
        return operations;
      },

      clearPendingOperations: (storeId?: string) => {
        if (storeId) {
          set((state) => {
            state.pendingOperations = state.pendingOperations.filter(
              (op) => op.storeId !== storeId
            );
          });
        } else {
          set({ pendingOperations: [] });
        }
      },

      // ============================================
      // Sync
      // ============================================

      setLastSyncAttempt: (timestamp: number) => {
        set({ lastSyncAttempt: timestamp });
      },

      incrementRetryCount: (id: string) => {
        set((state) => {
          const op = state.pendingOperations.find((op) => op.id === id);
          if (op) op.retryCount += 1;
        });
      },

      getFailedOperations: (): PendingOperation[] => {
        return get().pendingOperations.filter((op) => op.retryCount >= MAX_RETRY_COUNT);
      },
    })),
    {
      name: 'woocommerce-offline-store',
      partialize: (state) => ({
        pendingOperations: state.pendingOperations,
        lastSyncAttempt: state.lastSyncAttempt,
      }),
    }
  )
);

export default useOffline;

// Export types
export type { OfflineStore, OfflineStoreState, OfflineStoreActions };
export { MAX_RETRY_COUNT };
