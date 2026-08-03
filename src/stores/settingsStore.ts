import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AUTO_REFRESH } from '../constants/config';

// ============================================
// Types
// ============================================

type RefreshFunction = () => void;

interface SettingsState {
  autoRefresh: boolean;
  autoRefreshInterval: number;
  // Notification preferences
  notifyNewOrders: boolean;
  notifyLowStock: boolean;
  lowStockThreshold: number;
  // Business thresholds
  orderSplitDays: number;
  // Dynamic refresh functions set by DataManager
  refreshOrders: RefreshFunction | null;
  refreshProducts: RefreshFunction | null;
  refreshAll: RefreshFunction | null;
}

interface SettingsActions {
  setAutoRefresh: (enabled: boolean) => void;
  setAutoRefreshInterval: (interval: number) => void;
  toggleAutoRefresh: () => void;
  getAutoRefreshIntervalMs: () => number;
  setNotifyNewOrders: (enabled: boolean) => void;
  setNotifyLowStock: (enabled: boolean) => void;
  setLowStockThreshold: (threshold: number) => void;
  setOrderSplitDays: (days: number) => void;
  resetSettings: () => void;
  // Setters for refresh functions
  setRefreshFunctions: (fns: {
    refreshOrders?: RefreshFunction;
    refreshProducts?: RefreshFunction;
    refreshAll?: RefreshFunction;
  }) => void;
}

type SettingsStore = SettingsState & SettingsActions;

// ============================================
// Store
// ============================================

/**
 * Settings Store
 *
 * Manages application settings like auto-refresh configuration.
 * Persisted to localStorage for user preferences.
 */
const useSettings = create<SettingsStore>()(
  persist(
    (set, get) => ({
      // Auto-refresh settings
      autoRefresh: false,
      autoRefreshInterval: AUTO_REFRESH.DEFAULT_INTERVAL,

      // Notification preferences
      notifyNewOrders: true,
      notifyLowStock: false,
      lowStockThreshold: 5,
      // Business thresholds
      orderSplitDays: 7,

      // Dynamic refresh functions (set by DataManager)
      refreshOrders: null,
      refreshProducts: null,
      refreshAll: null,

      // Set auto-refresh enabled/disabled
      setAutoRefresh: (enabled: boolean) => {
        set({ autoRefresh: enabled });
      },

      // Set auto-refresh interval (in minutes)
      setAutoRefreshInterval: (interval: number) => {
        // Clamp interval to valid range
        const clampedInterval = Math.max(
          AUTO_REFRESH.MIN_INTERVAL,
          Math.min(AUTO_REFRESH.MAX_INTERVAL, interval)
        );
        set({ autoRefreshInterval: clampedInterval });
      },

      // Toggle auto-refresh
      toggleAutoRefresh: () => {
        set((state) => ({ autoRefresh: !state.autoRefresh }));
      },

      // Get auto-refresh interval in milliseconds
      getAutoRefreshIntervalMs: (): number => {
        return get().autoRefreshInterval * 60 * 1000;
      },

      // Notification setters
      setNotifyNewOrders: (enabled: boolean) => {
        set({ notifyNewOrders: enabled });
      },

      setNotifyLowStock: (enabled: boolean) => {
        set({ notifyLowStock: enabled });
      },

      setLowStockThreshold: (threshold: number) => {
        set({ lowStockThreshold: Math.max(1, threshold) });
      },

      setOrderSplitDays: (days: number) => {
        set({ orderSplitDays: Math.max(1, Math.min(90, days)) });
      },

      // Set refresh functions (called by DataManager)
      setRefreshFunctions: (fns) => {
        set({
          refreshOrders: fns.refreshOrders ?? get().refreshOrders,
          refreshProducts: fns.refreshProducts ?? get().refreshProducts,
          refreshAll: fns.refreshAll ?? get().refreshAll,
        });
      },

      // Reset to defaults
      resetSettings: () => {
        set({
          autoRefresh: false,
          autoRefreshInterval: AUTO_REFRESH.DEFAULT_INTERVAL,
          notifyNewOrders: true,
          notifyLowStock: false,
          lowStockThreshold: 5,
          orderSplitDays: 7,
          refreshOrders: null,
          refreshProducts: null,
          refreshAll: null,
        });
      },
    }),
    {
      name: 'woocommerce-settings',
      partialize: (state): Pick<SettingsState, 'autoRefresh' | 'autoRefreshInterval' | 'notifyNewOrders' | 'notifyLowStock' | 'lowStockThreshold' | 'orderSplitDays'> => ({
        autoRefresh: state.autoRefresh,
        autoRefreshInterval: state.autoRefreshInterval,
        notifyNewOrders: state.notifyNewOrders,
        notifyLowStock: state.notifyLowStock,
        lowStockThreshold: state.lowStockThreshold,
        orderSplitDays: state.orderSplitDays,
        // Don't persist refresh functions
      }),
    }
  )
);

export default useSettings;

// Export types for consumers
export type { SettingsState, SettingsActions, SettingsStore };
