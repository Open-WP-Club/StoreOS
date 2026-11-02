/**
 * Stores Index - unified access to all Zustand stores.
 * For arrays/objects use useShallow:
 *   const stores = useStoreConfig(useShallow(state => state.stores));
 */

// Re-export useShallow from zustand for convenience
export { useShallow } from 'zustand/shallow';

import type { WooCommerceProduct, WooCommerceOrder } from '../types';

// Individual stores
import useStoreConfig from './storeConfigStore';
import useTheme from './themeStore';
import useCache from './cacheStore';

export { useStoreConfig, useTheme, useCache };
export { default as useSettings } from './settingsStore';
export { default as useSearch } from './searchStore';
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
// Convenience Hooks
// ============================================

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
