import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { clearCacheStore, clearAllCache, STORES } from '../utils/indexedDBCache';
import { CACHE_EXPIRY } from '../constants/config';
import useStoreConfig from './storeConfigStore';
import { createProductsSlice } from './cache/productsSlice';
import { createOrdersSlice } from './cache/ordersSlice';
import { createCustomersSlice } from './cache/customersSlice';
import { createCouponsSlice } from './cache/couponsSlice';
import {
  createEmptyCacheEntry,
  createEmptyProductsCacheEntry,
  createEmptyOrdersCacheEntry,
} from './cache/types';
import type {
  WooCommerceProduct,
  WooCommerceOrder,
  WooCommerceCustomer,
  WooCommerceCoupon,
} from '../types';
import type { CacheStore, CacheType, CacheStoreState, CacheStoreActions } from './cache/types';

// ============================================
// Store
// ============================================

/**
 * Cache Store
 *
 * Manages in-memory and IndexedDB caching for products and orders.
 * Implements split caching for orders (recent vs old) with different expiry times.
 * Per-resource logic lives in ./cache/*Slice.ts; this file wires the slices
 * together and owns the cross-resource dispatch methods (getCachedData,
 * setCachedData, clearCache, clearCacheForType, isCacheValid, getCacheAge).
 *
 * Cache Strategy:
 * - Products: 30-minute expiry
 * - Recent orders (< 7 days): 15-minute expiry
 * - Old orders (>= 7 days): 7-day expiry
 */
const useCache = create<CacheStore>()(
  immer((set, get, api) => ({
    // Cache state - not persisted (uses IndexedDB instead)
    cache: {
      products: createEmptyProductsCacheEntry(),
      productsRecent: createEmptyCacheEntry<WooCommerceProduct[]>(),
      productsOld: createEmptyCacheEntry<WooCommerceProduct[]>(),
      orders: createEmptyOrdersCacheEntry(),
      ordersRecent: createEmptyCacheEntry<WooCommerceOrder[]>(),
      ordersOld: createEmptyCacheEntry<WooCommerceOrder[]>(),
      customers: createEmptyCacheEntry<WooCommerceCustomer[]>(),
      coupons: createEmptyCacheEntry<WooCommerceCoupon[]>(),
    },

    ...createProductsSlice(set, get, api),
    ...createOrdersSlice(set, get, api),
    ...createCustomersSlice(set, get, api),
    ...createCouponsSlice(set, get, api),

    // ============================================
    // Cross-resource dispatch
    // ============================================

    /**
     * Get cached data for a specific type.
     * Checks: memory cache -> IndexedDB -> returns null.
     */
    getCachedData: async (type: CacheType) => {
      const currentStoreId = useStoreConfig.getState().currentStoreId;
      if (!currentStoreId) return null;

      if (type === 'orders') return get().getCachedOrders(currentStoreId);
      if (type === 'products') return get().getCachedProducts(currentStoreId);
      if (type === 'customers') return get().getCachedCustomers(currentStoreId);
      if (type === 'coupons') return get().getCachedCoupons(currentStoreId);

      return null;
    },

    /**
     * Set cached data for a specific type.
     * Stores in memory and persists to IndexedDB.
     */
    setCachedData: async (
      type: CacheType,
      data: WooCommerceProduct[] | WooCommerceOrder[] | WooCommerceCustomer[] | WooCommerceCoupon[]
    ) => {
      const currentStoreId = useStoreConfig.getState().currentStoreId;
      const now = Date.now();
      if (!currentStoreId) return;

      if (type === 'orders' && Array.isArray(data)) {
        await get().setCachedOrders(data as WooCommerceOrder[], currentStoreId, now);
        return;
      }
      if (type === 'products' && Array.isArray(data)) {
        await get().setCachedProducts(data as WooCommerceProduct[], currentStoreId, now);
        return;
      }
      if (type === 'customers' && Array.isArray(data)) {
        await get().setCachedCustomers(data as WooCommerceCustomer[], currentStoreId, now);
        return;
      }
      if (type === 'coupons' && Array.isArray(data)) {
        await get().setCachedCoupons(data as WooCommerceCoupon[], currentStoreId, now);
        return;
      }
    },

    /** Clear all cache (memory + IndexedDB). */
    clearCache: async () => {
      set({
        cache: {
          products: createEmptyProductsCacheEntry(),
          productsRecent: createEmptyCacheEntry<WooCommerceProduct[]>(),
          productsOld: createEmptyCacheEntry<WooCommerceProduct[]>(),
          orders: createEmptyOrdersCacheEntry(),
          ordersRecent: createEmptyCacheEntry<WooCommerceOrder[]>(),
          ordersOld: createEmptyCacheEntry<WooCommerceOrder[]>(),
          customers: createEmptyCacheEntry<WooCommerceCustomer[]>(),
          coupons: createEmptyCacheEntry<WooCommerceCoupon[]>(),
        },
      });

      try {
        await clearAllCache();
      } catch {
        // Error handled silently
      }
    },

    /** Clear cache for a specific type (including split caches). */
    clearCacheForType: async (type: CacheType) => {
      if (type === 'orders') {
        set((state) => {
          state.cache.orders = createEmptyOrdersCacheEntry();
          state.cache.ordersRecent = createEmptyCacheEntry<WooCommerceOrder[]>();
          state.cache.ordersOld = createEmptyCacheEntry<WooCommerceOrder[]>();
        });
      } else if (type === 'products') {
        set((state) => {
          state.cache.products = createEmptyProductsCacheEntry();
          state.cache.productsRecent = createEmptyCacheEntry<WooCommerceProduct[]>();
          state.cache.productsOld = createEmptyCacheEntry<WooCommerceProduct[]>();
        });
      } else if (type === 'customers') {
        set((state) => {
          state.cache.customers = createEmptyCacheEntry<WooCommerceCustomer[]>();
        });
      } else if (type === 'coupons') {
        set((state) => {
          state.cache.coupons = createEmptyCacheEntry<WooCommerceCoupon[]>();
        });
      }

      try {
        const storeName = STORES[type.toUpperCase() as keyof typeof STORES];
        await clearCacheStore(storeName);
      } catch {
        // Error handled silently
      }
    },

    /** Check if cache is valid for a specific type. */
    isCacheValid: (type: CacheType): boolean => {
      const state = get();
      const currentStoreId = useStoreConfig.getState().currentStoreId;
      const cached = state.cache[type];

      if (!cached.data || cached.storeId !== currentStoreId || !cached.timestamp) {
        return false;
      }

      const cacheExpiryTime =
        CACHE_EXPIRY[type.toUpperCase() as keyof typeof CACHE_EXPIRY] || CACHE_EXPIRY.DEFAULT;
      return Date.now() - cached.timestamp < cacheExpiryTime;
    },

    /** Get cache age in seconds. */
    getCacheAge: (type: CacheType): number | null => {
      const cached = get().cache[type];
      if (!cached.timestamp) return null;
      return Math.round((Date.now() - cached.timestamp) / 1000);
    },
  }))
);

export default useCache;

// Export types for consumers
export type { CacheStore, CacheStoreState, CacheStoreActions, CacheType };
