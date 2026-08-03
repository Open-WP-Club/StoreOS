/**
 * Stores Index
 *
 * Provides unified access to all Zustand stores.
 * Maintains backward compatibility with the original monolithic useStore.
 *
 * Migration Guide:
 * ---------------
 * Old: import useStore from '../stores/useStore';
 *      const theme = useStore(state => state.theme);
 *
 * New: import { useTheme } from '../stores';
 *      const theme = useTheme(state => state.theme);
 *
 * Or for multiple stores:
 *      import { useTheme, useStoreConfig, useCache } from '../stores';
 *
 * For arrays/objects, use useShallow for optimal performance:
 *      import { useStoreConfig, useShallow } from '../stores';
 *      const stores = useStoreConfig(useShallow(state => state.stores));
 */

// Re-export useShallow from zustand for convenience
export { useShallow } from 'zustand/shallow';

import type { WooCommerceStore, WooCommerceProduct, WooCommerceOrder, WooCommerceCustomer, WooCommerceCoupon, Theme, FilterPreset } from '../types';

// Individual stores
export { default as useStoreConfig } from './storeConfigStore';
export { default as useTheme } from './themeStore';
export { default as useSettings } from './settingsStore';
export { default as useSearch } from './searchStore';
export { default as useCache } from './cacheStore';
export { default as useAppSettings } from './appSettingsStore';
export { default as useOffline } from './offlineStore';
export { default as useNotifications } from './notificationStore';
export { default as useActivityLog } from './activityLogStore';

// Re-export store types
export type { StoreConfigStore, StoreConfigState, NewStoreInput } from './storeConfigStore';
export type { ThemeStore, ThemeState } from './themeStore';
export type { SettingsStore, SettingsState } from './settingsStore';
export type { SearchStore, SearchState } from './searchStore';
export type { CacheStore, CacheStoreState, CacheType } from './cacheStore';
export type { AppSettingsStore, AppSettingsState } from './appSettingsStore';
export type { OfflineStore, OfflineStoreState, OfflineStoreActions } from './offlineStore';
export type { NotificationStore, AppNotification, NotificationType } from './notificationStore';
export type { ActivityLogStore } from './activityLogStore';

// ============================================
// Backward Compatibility Layer
// ============================================

import useStoreConfig from './storeConfigStore';
import useTheme from './themeStore';
import useSettings from './settingsStore';
import useSearch from './searchStore';
import useCache from './cacheStore';

/**
 * Combined state type for backward compatibility
 */
interface CombinedState {
  // Store config
  stores: WooCommerceStore[];
  currentStoreId: string | null;
  addStore: (store: {
    name: string;
    url: string;
    consumerKey: string;
    consumerSecret: string;
  }) => WooCommerceStore;
  updateStore: (id: string, updates: Partial<WooCommerceStore>) => void;
  removeStore: (id: string) => void;
  setCurrentStore: (id: string) => void;
  getCurrentStore: () => WooCommerceStore | undefined;

  // Theme
  theme: Theme;
  isTogglingTheme: boolean;
  toggleTheme: () => void;

  // Settings
  autoRefresh: boolean;
  autoRefreshInterval: number;
  setAutoRefresh: (enabled: boolean) => void;
  setAutoRefreshInterval: (minutes: number) => void;
  // Dynamic refresh functions
  refreshOrders: (() => void) | null;
  refreshProducts: (() => void) | null;
  refreshAll: (() => void) | null;

  // Search
  recentSearches: Array<{
    id: string;
    query: string;
    type: 'global' | 'orders' | 'products' | 'customers';
    storeId: string | null;
    timestamp: string;
  }>;
  savedFilterPresets: FilterPreset[];
  maxRecentSearches: number;
  addRecentSearch: (search: { query: string; type?: 'global' | 'orders' | 'products'; storeId?: string | null }) => void;
  clearRecentSearches: () => void;
  removeRecentSearch: (id: string) => void;
  addFilterPreset: (preset: {
    name: string;
    type?: 'orders' | 'products';
    filters?: Record<string, unknown>;
    storeId?: string | null;
  }) => FilterPreset;
  updateFilterPreset: (id: string, updates: Partial<{
    name: string;
    type: 'orders' | 'products';
    filters: Record<string, unknown>;
    storeId: string | null;
  }>) => void;
  deleteFilterPreset: (id: string) => void;
  getFilterPresetsForType: (type: 'orders' | 'products', storeId?: string | null) => FilterPreset[];

  // Cache
  cache: {
    products: {
      data: WooCommerceProduct[] | null;
      timestamp: number | null;
      storeId: string | null;
      lastSync: string | null;
    };
    productsRecent: {
      data: WooCommerceProduct[] | null;
      timestamp: number | null;
      storeId: string | null;
    };
    productsOld: {
      data: WooCommerceProduct[] | null;
      timestamp: number | null;
      storeId: string | null;
    };
    orders: {
      data: WooCommerceOrder[] | null;
      timestamp: number | null;
      storeId: string | null;
      partial?: boolean;
    };
    ordersRecent: {
      data: WooCommerceOrder[] | null;
      timestamp: number | null;
      storeId: string | null;
    };
    ordersOld: {
      data: WooCommerceOrder[] | null;
      timestamp: number | null;
      storeId: string | null;
    };
    customers: {
      data: WooCommerceCustomer[] | null;
      timestamp: number | null;
      storeId: string | null;
    };
    coupons: {
      data: WooCommerceCoupon[] | null;
      timestamp: number | null;
      storeId: string | null;
    };
  };
  getCachedData: (type: 'products' | 'orders' | 'customers' | 'coupons') => Promise<WooCommerceProduct[] | WooCommerceOrder[] | WooCommerceCustomer[] | WooCommerceCoupon[] | null>;
  setCachedData: (type: 'products' | 'orders' | 'customers' | 'coupons', data: WooCommerceProduct[] | WooCommerceOrder[] | WooCommerceCustomer[] | WooCommerceCoupon[]) => Promise<void>;
  clearCache: () => Promise<void>;
  clearCacheForType: (type: 'products' | 'orders' | 'customers' | 'coupons') => Promise<void>;
}

type Selector<T> = (state: CombinedState) => T;

/**
 * Combined store selector for backward compatibility
 *
 * This allows existing code to continue working with minimal changes.
 * Gradually migrate to individual stores for better performance.
 *
 * @deprecated Use individual stores instead for better performance
 *
 * @example
 * // Old pattern (still works but triggers more re-renders)
 * const theme = useStore(state => state.theme);
 *
 * // New pattern (recommended - fewer re-renders)
 * const theme = useTheme(state => state.theme);
 */
function useStore(): CombinedState;
// eslint-disable-next-line no-redeclare
function useStore<T>(selector: Selector<T>): T;
// eslint-disable-next-line no-redeclare
function useStore<T>(selector?: Selector<T>): CombinedState | T {
  // Get state from all stores
  const storeConfig = useStoreConfig();
  const theme = useTheme();
  const settings = useSettings();
  const search = useSearch();
  const cache = useCache();

  // Combine into unified state object
  const combinedState: CombinedState = {
    // Store config
    stores: storeConfig.stores,
    currentStoreId: storeConfig.currentStoreId,
    addStore: storeConfig.addStore,
    updateStore: storeConfig.updateStore,
    removeStore: storeConfig.removeStore,
    setCurrentStore: storeConfig.setCurrentStore,
    getCurrentStore: storeConfig.getCurrentStore,

    // Theme
    theme: theme.theme,
    isTogglingTheme: theme.isTogglingTheme,
    toggleTheme: theme.toggleTheme,

    // Settings
    autoRefresh: settings.autoRefresh,
    autoRefreshInterval: settings.autoRefreshInterval,
    setAutoRefresh: settings.setAutoRefresh,
    setAutoRefreshInterval: settings.setAutoRefreshInterval,
    refreshOrders: settings.refreshOrders,
    refreshProducts: settings.refreshProducts,
    refreshAll: settings.refreshAll,

    // Search
    recentSearches: search.recentSearches,
    savedFilterPresets: search.savedFilterPresets,
    maxRecentSearches: search.maxRecentSearches,
    addRecentSearch: search.addRecentSearch,
    clearRecentSearches: search.clearRecentSearches,
    removeRecentSearch: search.removeRecentSearch,
    addFilterPreset: search.addFilterPreset,
    updateFilterPreset: search.updateFilterPreset,
    deleteFilterPreset: search.deleteFilterPreset,
    getFilterPresetsForType: search.getFilterPresetsForType,

    // Cache
    cache: cache.cache,
    getCachedData: cache.getCachedData,
    setCachedData: cache.setCachedData,
    clearCache: cache.clearCache,
    clearCacheForType: cache.clearCacheForType,
  };

  // If selector provided, use it
  if (typeof selector === 'function') {
    return selector(combinedState);
  }

  return combinedState;
}

// Add static methods for direct state access
interface UseStoreWithStatic {
  (): CombinedState;
  <T>(selector: Selector<T>): T;
  getState: () => CombinedState;
  setState: (updates: Partial<CombinedState>) => void;
}

const useStoreWithStatic = useStore as UseStoreWithStatic;

// Also allow direct state access without selector
useStoreWithStatic.getState = (): CombinedState => {
  const storeConfig = useStoreConfig.getState();
  const theme = useTheme.getState();
  const settings = useSettings.getState();
  const search = useSearch.getState();
  const cache = useCache.getState();

  return {
    // Store config
    stores: storeConfig.stores,
    currentStoreId: storeConfig.currentStoreId,
    addStore: storeConfig.addStore,
    updateStore: storeConfig.updateStore,
    removeStore: storeConfig.removeStore,
    setCurrentStore: storeConfig.setCurrentStore,
    getCurrentStore: storeConfig.getCurrentStore,

    // Theme
    theme: theme.theme,
    isTogglingTheme: theme.isTogglingTheme,
    toggleTheme: theme.toggleTheme,

    // Settings
    autoRefresh: settings.autoRefresh,
    autoRefreshInterval: settings.autoRefreshInterval,
    setAutoRefresh: settings.setAutoRefresh,
    setAutoRefreshInterval: settings.setAutoRefreshInterval,
    refreshOrders: settings.refreshOrders,
    refreshProducts: settings.refreshProducts,
    refreshAll: settings.refreshAll,

    // Search
    recentSearches: search.recentSearches,
    savedFilterPresets: search.savedFilterPresets,
    maxRecentSearches: search.maxRecentSearches,
    addRecentSearch: search.addRecentSearch,
    clearRecentSearches: search.clearRecentSearches,
    removeRecentSearch: search.removeRecentSearch,
    addFilterPreset: search.addFilterPreset,
    updateFilterPreset: search.updateFilterPreset,
    deleteFilterPreset: search.deleteFilterPreset,
    getFilterPresetsForType: search.getFilterPresetsForType,

    // Cache
    cache: cache.cache,
    getCachedData: cache.getCachedData,
    setCachedData: cache.setCachedData,
    clearCache: cache.clearCache,
    clearCacheForType: cache.clearCacheForType,
  };
};

// Allow setState for advanced use cases
useStoreWithStatic.setState = (updates: Partial<CombinedState>): void => {
  // eslint-disable-next-line no-console -- Intentional deprecation warning for developers
  console.warn(
    'useStore.setState is deprecated. Use individual store setState instead.',
    Object.keys(updates)
  );

  // Route updates to appropriate stores
  const storeConfigKeys = ['stores', 'currentStoreId'];
  const themeKeys = ['theme', 'isTogglingTheme'];
  const settingsKeys = ['autoRefresh', 'autoRefreshInterval', 'refreshOrders', 'refreshProducts', 'refreshAll'];
  const searchKeys = ['recentSearches', 'savedFilterPresets', 'maxRecentSearches'];
  const cacheKeys = ['cache'];

  Object.entries(updates).forEach(([key, value]) => {
    if (storeConfigKeys.includes(key)) {
      useStoreConfig.setState({ [key]: value } as Partial<ReturnType<typeof useStoreConfig.getState>>);
    } else if (themeKeys.includes(key)) {
      useTheme.setState({ [key]: value } as Partial<ReturnType<typeof useTheme.getState>>);
    } else if (settingsKeys.includes(key)) {
      useSettings.setState({ [key]: value } as Partial<ReturnType<typeof useSettings.getState>>);
    } else if (searchKeys.includes(key)) {
      useSearch.setState({ [key]: value } as Partial<ReturnType<typeof useSearch.getState>>);
    } else if (cacheKeys.includes(key)) {
      useCache.setState({ [key]: value } as Partial<ReturnType<typeof useCache.getState>>);
    }
  });
};

export default useStoreWithStatic;

// Export types
export type { CombinedState, Selector };

// ============================================
// Convenience Hooks
// ============================================

/**
 * Hook to get the current store configuration
 * @returns Current store or undefined
 */
export const useCurrentStore = (): WooCommerceStore | undefined => {
  return useStoreConfig((state) => state.getCurrentStore());
};

/**
 * Hook to check if dark mode is active
 * @returns boolean
 */
export const useIsDarkMode = (): boolean => {
  return useTheme((state) => state.theme === 'dark');
};

/**
 * Hook to get cached products
 * @returns Products from cache
 */
export const useCachedProducts = (): WooCommerceProduct[] => {
  return useCache((state) => state.cache.products.data || []);
};

/**
 * Hook to get cached orders
 * @returns Orders from cache
 */
export const useCachedOrders = (): WooCommerceOrder[] => {
  return useCache((state) => state.cache.orders.data || []);
};

/**
 * Hook to get cached customers
 * @returns Customers from cache
 */
export const useCachedCustomers = (): WooCommerceCustomer[] => {
  return useCache((state) => state.cache.customers.data || []);
};
