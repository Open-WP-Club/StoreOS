import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ActivityLogEntry, ActivityAction, ActivityEntityType } from '../types';
import { prependAndTrim, nowISO } from './storeUtils';

// ============================================
// Types
// ============================================

interface ActivityLogState {
  entries: ActivityLogEntry[];
  maxEntries: number;
}

interface ActivityLogActions {
  logActivity: (entry: Omit<ActivityLogEntry, 'id' | 'timestamp'>) => ActivityLogEntry;
  clearLog: () => void;
  clearLogForStore: (storeId: string) => void;
  getEntriesForStore: (storeId: string | null) => ActivityLogEntry[];
  getEntriesByType: (entityType: ActivityEntityType) => ActivityLogEntry[];
  getEntriesByAction: (action: ActivityAction) => ActivityLogEntry[];
}

export type ActivityLogStore = ActivityLogState & ActivityLogActions;

// ============================================
// Store
// ============================================

const useActivityLog = create<ActivityLogStore>()(
  persist(
    (set, get) => ({
      entries: [],
      maxEntries: 500,

      logActivity: (entry) => {
        const newEntry: ActivityLogEntry = {
          ...entry,
          id: crypto.randomUUID(),
          timestamp: nowISO(),
        };

        set((state) => ({
          entries: prependAndTrim(state.entries, newEntry, state.maxEntries),
        }));

        return newEntry;
      },

      clearLog: () => {
        set({ entries: [] });
      },

      clearLogForStore: (storeId) => {
        set((state) => ({
          entries: state.entries.filter((e) => e.storeId !== storeId),
        }));
      },

      getEntriesForStore: (storeId) => {
        return get().entries.filter((e) => e.storeId === storeId);
      },

      getEntriesByType: (entityType) => {
        return get().entries.filter((e) => e.entityType === entityType);
      },

      getEntriesByAction: (action) => {
        return get().entries.filter((e) => e.action === action);
      },
    }),
    {
      name: 'woocommerce-activity-log',
      partialize: (state): Pick<ActivityLogState, 'entries'> => ({
        entries: state.entries,
      }),
    }
  )
);

export default useActivityLog;
