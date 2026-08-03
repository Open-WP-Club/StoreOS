import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import {
  saveToCache,
  getFromCache,
  clearCacheStore,
  clearAllCache,
  STORES,
} from '../utils/indexedDBCache';
import { CACHE_EXPIRY, TIME } from '../constants/config';
import useStoreConfig from './storeConfigStore';
import useSettings from './settingsStore';
import type {
  WooCommerceProduct,
  WooCommerceOrder,
  WooCommerceCustomer,
  WooCommerceCoupon,
  CacheEntry,
  ProductsCacheEntry,
  OrdersCacheEntry,
  CacheState,
} from '../types';

// ============================================
// Types
// ============================================

type CacheType = 'products' | 'orders' | 'customers' | 'coupons';

interface CacheStoreState {
  cache: CacheState;
}

interface CacheStoreActions {
  getCachedData: (type: CacheType) => Promise<WooCommerceProduct[] | WooCommerceOrder[] | WooCommerceCustomer[] | WooCommerceCoupon[] | null>;
  getCachedProducts: (currentStoreId: string) => Promise<WooCommerceProduct[] | null>;
  getCachedOrders: (currentStoreId: string) => Promise<WooCommerceOrder[] | null>;
  getCachedCustomers: (currentStoreId: string) => Promise<WooCommerceCustomer[] | null>;
  getCachedCoupons: (currentStoreId: string) => Promise<WooCommerceCoupon[] | null>;
  setCachedData: (type: CacheType, data: WooCommerceProduct[] | WooCommerceOrder[] | WooCommerceCustomer[] | WooCommerceCoupon[]) => Promise<void>;
  setCachedProducts: (data: WooCommerceProduct[], currentStoreId: string, now: number) => Promise<void>;
  setCachedOrders: (data: WooCommerceOrder[], currentStoreId: string, now: number) => Promise<void>;
  setCachedCustomers: (data: WooCommerceCustomer[], currentStoreId: string, now: number) => Promise<void>;
  setCachedCoupons: (data: WooCommerceCoupon[], currentStoreId: string, now: number) => Promise<void>;
  setProductsLastSync: (timestamp: string) => Promise<void>;
  getProductsLastSync: () => string | null;
  clearCache: () => Promise<void>;
  clearCacheForType: (type: CacheType) => Promise<void>;
  isCacheValid: (type: CacheType) => boolean;
  getCacheAge: (type: CacheType) => number | null;
}

type CacheStore = CacheStoreState & CacheStoreActions;

// ============================================
// Helpers
// ============================================

/**
 * Initial cache state for each data type
 */
const createEmptyCacheEntry = <T>(): CacheEntry<T> => ({
  data: null,
  timestamp: null,
  storeId: null,
});

const createEmptyProductsCacheEntry = (): ProductsCacheEntry => ({
  ...createEmptyCacheEntry<WooCommerceProduct[]>(),
  lastSync: null,
});

const createEmptyOrdersCacheEntry = (): OrdersCacheEntry => ({
  ...createEmptyCacheEntry<WooCommerceOrder[]>(),
});

// ============================================
// Store
// ============================================

/**
 * Cache Store
 *
 * Manages in-memory and IndexedDB caching for products and orders.
 * Implements split caching for orders (recent vs old) with different expiry times.
 *
 * Cache Strategy:
 * - Products: 30-minute expiry
 * - Recent orders (< 7 days): 15-minute expiry
 * - Old orders (>= 7 days): 7-day expiry
 */
const useCache = create<CacheStore>()(immer((set, get) => ({
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

  // ============================================
  // Cache Retrieval
  // ============================================

  /**
   * Get cached data for a specific type
   * Checks: memory cache -> IndexedDB -> returns null
   * Uses split caching for both products and orders
   */
  getCachedData: async (type: CacheType) => {
    const currentStoreId = useStoreConfig.getState().currentStoreId;

    if (!currentStoreId) return null;

    // Handle orders with split caching
    if (type === 'orders') {
      return get().getCachedOrders(currentStoreId);
    }

    // Handle products with split caching
    if (type === 'products') {
      return get().getCachedProducts(currentStoreId);
    }

    // Handle customers
    if (type === 'customers') {
      return get().getCachedCustomers(currentStoreId);
    }

    // Handle coupons
    if (type === 'coupons') {
      return get().getCachedCoupons(currentStoreId);
    }

    return null;
  },

  /**
   * Get cached products with split recent/old strategy
   */
  getCachedProducts: async (currentStoreId: string): Promise<WooCommerceProduct[] | null> => {
    const state = get();
    const now = Date.now();

    let recentProducts: WooCommerceProduct[] | null = null;
    let oldProducts: WooCommerceProduct[] | null = null;

    // Check recent products cache (30-minute expiry)
    const recentCached = state.cache.productsRecent;
    if (
      recentCached.data &&
      recentCached.storeId === currentStoreId &&
      recentCached.timestamp &&
      now - recentCached.timestamp < CACHE_EXPIRY.PRODUCTS_RECENT
    ) {
      recentProducts = recentCached.data;
    } else {
      // Try IndexedDB
      try {
        recentProducts = await getFromCache(
          STORES.PRODUCTS,
          `${currentStoreId}_recent`,
          CACHE_EXPIRY.PRODUCTS_RECENT
        ) as WooCommerceProduct[] | null;
        if (recentProducts) {
          set((state) => {
            state.cache.productsRecent = {
              data: recentProducts,
              timestamp: now,
              storeId: currentStoreId,
            };
          });
        }
      } catch {
        // Error handled silently
      }
    }

    // Check old products cache (7-day expiry)
    const oldCached = state.cache.productsOld;
    if (
      oldCached.data &&
      oldCached.storeId === currentStoreId &&
      oldCached.timestamp &&
      now - oldCached.timestamp < CACHE_EXPIRY.PRODUCTS_OLD
    ) {
      oldProducts = oldCached.data;
    } else {
      // Try IndexedDB
      try {
        oldProducts = await getFromCache(
          STORES.PRODUCTS,
          `${currentStoreId}_old`,
          CACHE_EXPIRY.PRODUCTS_OLD
        ) as WooCommerceProduct[] | null;
        if (oldProducts) {
          set((state) => {
            state.cache.productsOld = {
              data: oldProducts,
              timestamp: now,
              storeId: currentStoreId,
            };
          });
        }
      } catch {
        // Error handled silently
      }
    }

    // Try to restore lastSync from IndexedDB if not in memory
    if (!state.cache.products.lastSync) {
      try {
        const savedLastSync = await getFromCache(
          STORES.PRODUCTS,
          `${currentStoreId}_lastSync`,
          365 * 24 * 60 * 60 * 1000 // 1 year - lastSync should persist long
        ) as string | null;
        if (savedLastSync) {
          set((state) => {
            state.cache.products.lastSync = savedLastSync;
          });
        }
      } catch {
        // Error handled silently
      }
    }

    // Merge and return
    if (recentProducts || oldProducts) {
      const merged = [...(recentProducts || []), ...(oldProducts || [])];

      set((state) => {
        state.cache.products.data = merged;
        state.cache.products.timestamp = now;
        state.cache.products.storeId = currentStoreId;
      });

      return merged;
    }

    return null;
  },

  /**
   * Get cached orders with split recent/old strategy
   */
  getCachedOrders: async (currentStoreId: string): Promise<WooCommerceOrder[] | null> => {
    const state = get();
    const now = Date.now();

    let recentOrders: WooCommerceOrder[] | null = null;
    let oldOrders: WooCommerceOrder[] | null = null;

    // Check recent orders cache (15-minute expiry)
    const recentCached = state.cache.ordersRecent;
    if (
      recentCached.data &&
      recentCached.storeId === currentStoreId &&
      recentCached.timestamp &&
      now - recentCached.timestamp < CACHE_EXPIRY.ORDERS_RECENT
    ) {
      recentOrders = recentCached.data;
    } else {
      // Try IndexedDB
      try {
        recentOrders = await getFromCache(
          STORES.ORDERS,
          `${currentStoreId}_recent`,
          CACHE_EXPIRY.ORDERS_RECENT
        ) as WooCommerceOrder[] | null;
        if (recentOrders) {
          set((state) => {
            state.cache.ordersRecent = {
              data: recentOrders,
              timestamp: now,
              storeId: currentStoreId,
            };
          });
        }
      } catch {
        // Error handled silently
      }
    }

    // Check final/completed orders cache (30-day expiry - they don't change)
    const oldCached = state.cache.ordersOld;
    if (
      oldCached.data &&
      oldCached.storeId === currentStoreId &&
      oldCached.timestamp &&
      now - oldCached.timestamp < CACHE_EXPIRY.ORDERS_COMPLETED
    ) {
      oldOrders = oldCached.data;
    } else {
      // Try IndexedDB
      try {
        oldOrders = await getFromCache(
          STORES.ORDERS,
          `${currentStoreId}_old`,
          CACHE_EXPIRY.ORDERS_COMPLETED
        ) as WooCommerceOrder[] | null;
        if (oldOrders) {
          set((state) => {
            state.cache.ordersOld = {
              data: oldOrders,
              timestamp: now,
              storeId: currentStoreId,
            };
          });
        }
      } catch {
        // Error handled silently
      }
    }

    // Merge and return
    if (recentOrders || oldOrders) {
      const merged = [...(recentOrders || []), ...(oldOrders || [])];
      const isPartial = !(recentOrders && oldOrders);

      set((state) => {
        state.cache.orders.data = merged;
        state.cache.orders.timestamp = now;
        state.cache.orders.storeId = currentStoreId;
        state.cache.orders.partial = isPartial;
      });

      return merged;
    }

    return null;
  },

  /**
   * Get cached customers
   */
  getCachedCustomers: async (currentStoreId: string): Promise<WooCommerceCustomer[] | null> => {
    const state = get();
    const now = Date.now();

    // Check memory cache
    const cached = state.cache.customers;
    if (
      cached.data &&
      cached.storeId === currentStoreId &&
      cached.timestamp &&
      now - cached.timestamp < CACHE_EXPIRY.CUSTOMERS
    ) {
      return cached.data;
    }

    // Try IndexedDB
    try {
      const customers = await getFromCache(
        STORES.CUSTOMERS,
        currentStoreId,
        CACHE_EXPIRY.CUSTOMERS
      ) as WooCommerceCustomer[] | null;
      if (customers) {
        set((state) => {
          state.cache.customers = {
            data: customers,
            timestamp: now,
            storeId: currentStoreId,
          };
        });
        return customers;
      }
    } catch {
      // Error handled silently
    }

    return null;
  },

  /**
   * Get cached coupons
   */
  getCachedCoupons: async (currentStoreId: string): Promise<WooCommerceCoupon[] | null> => {
    const state = get();
    const now = Date.now();

    // Check memory cache
    const cached = state.cache.coupons;
    if (
      cached.data &&
      cached.storeId === currentStoreId &&
      cached.timestamp &&
      now - cached.timestamp < CACHE_EXPIRY.COUPONS
    ) {
      return cached.data;
    }

    // Try IndexedDB
    try {
      const coupons = await getFromCache(
        STORES.COUPONS,
        currentStoreId,
        CACHE_EXPIRY.COUPONS
      ) as WooCommerceCoupon[] | null;
      if (coupons) {
        set((state) => {
          state.cache.coupons = {
            data: coupons,
            timestamp: now,
            storeId: currentStoreId,
          };
        });
        return coupons;
      }
    } catch {
      // Error handled silently
    }

    return null;
  },

  // ============================================
  // Cache Storage
  // ============================================

  /**
   * Set cached data for a specific type
   * Stores in memory and persists to IndexedDB with split caching
   */
  setCachedData: async (type: CacheType, data: WooCommerceProduct[] | WooCommerceOrder[] | WooCommerceCustomer[] | WooCommerceCoupon[]) => {
    const currentStoreId = useStoreConfig.getState().currentStoreId;
    const now = Date.now();

    if (!currentStoreId) return;

    // Handle orders with split caching
    if (type === 'orders' && Array.isArray(data)) {
      await get().setCachedOrders(data as WooCommerceOrder[], currentStoreId, now);
      return;
    }

    // Handle products with split caching
    if (type === 'products' && Array.isArray(data)) {
      await get().setCachedProducts(data as WooCommerceProduct[], currentStoreId, now);
      return;
    }

    // Handle customers
    if (type === 'customers' && Array.isArray(data)) {
      await get().setCachedCustomers(data as WooCommerceCustomer[], currentStoreId, now);
      return;
    }

    // Handle coupons
    if (type === 'coupons' && Array.isArray(data)) {
      await get().setCachedCoupons(data as WooCommerceCoupon[], currentStoreId, now);
      return;
    }
  },

  /**
   * Set cached products with split recent/old strategy
   */
  setCachedProducts: async (data: WooCommerceProduct[], currentStoreId: string, now: number) => {
    const recentProducts: WooCommerceProduct[] = [];
    const oldProducts: WooCommerceProduct[] = [];

    // Split products by modification date using configurable window
    const splitThreshold = useSettings.getState().orderSplitDays * TIME.DAY;
    for (const product of data) {
      const modifiedDate = new Date(product.date_modified_gmt || product.date_modified || product.date_created).getTime();
      const productAge = now - modifiedDate;

      if (productAge < splitThreshold) {
        recentProducts.push(product);
      } else {
        oldProducts.push(product);
      }
    }

    // Update memory cache
    set((state) => {
      state.cache.products.data = data;
      state.cache.products.timestamp = now;
      state.cache.products.storeId = currentStoreId;
      state.cache.productsRecent = { data: recentProducts, timestamp: now, storeId: currentStoreId };
      state.cache.productsOld = { data: oldProducts, timestamp: now, storeId: currentStoreId };
    });

    // Persist to IndexedDB
    try {
      await Promise.all([
        saveToCache(STORES.PRODUCTS, currentStoreId, data),
        saveToCache(STORES.PRODUCTS, `${currentStoreId}_recent`, recentProducts),
        saveToCache(STORES.PRODUCTS, `${currentStoreId}_old`, oldProducts),
      ]);
    } catch {
      // Error handled silently
    }
  },

  /**
   * Set cached orders with split active/final strategy
   * Final status orders (completed, cancelled, refunded, failed, trash) get longer cache
   * Active orders (pending, processing, on-hold) need frequent updates
   */
  setCachedOrders: async (data: WooCommerceOrder[], currentStoreId: string, now: number) => {
    const activeOrders: WooCommerceOrder[] = [];
    const finalOrders: WooCommerceOrder[] = [];

    // Final statuses that don't need frequent refresh
    const FINAL_STATUSES = ['completed', 'cancelled', 'refunded', 'failed', 'trash'];

    // Split orders by status (more logical than age-based)
    for (const order of data) {
      if (FINAL_STATUSES.includes(order.status)) {
        finalOrders.push(order);
      } else {
        activeOrders.push(order);
      }
    }

    // Update memory cache
    // ordersRecent = active orders (short cache)
    // ordersOld = final orders (long cache - they don't change)
    set((state) => {
      state.cache.orders = { data, timestamp: now, storeId: currentStoreId };
      state.cache.ordersRecent = { data: activeOrders, timestamp: now, storeId: currentStoreId };
      state.cache.ordersOld = { data: finalOrders, timestamp: now, storeId: currentStoreId };
    });

    // Persist to IndexedDB
    try {
      await Promise.all([
        saveToCache(STORES.ORDERS, currentStoreId, data),
        saveToCache(STORES.ORDERS, `${currentStoreId}_recent`, activeOrders),
        saveToCache(STORES.ORDERS, `${currentStoreId}_old`, finalOrders),
      ]);
    } catch {
      // Error handled silently
    }
  },

  /**
   * Set cached customers
   */
  setCachedCustomers: async (data: WooCommerceCustomer[], currentStoreId: string, now: number) => {
    // Update memory cache
    set((state) => {
      state.cache.customers = { data, timestamp: now, storeId: currentStoreId };
    });

    // Persist to IndexedDB
    try {
      await saveToCache(STORES.CUSTOMERS, currentStoreId, data);
    } catch {
      // Error handled silently
    }
  },

  /**
   * Set cached coupons
   */
  setCachedCoupons: async (data: WooCommerceCoupon[], currentStoreId: string, now: number) => {
    // Update memory cache
    set((state) => {
      state.cache.coupons = { data, timestamp: now, storeId: currentStoreId };
    });

    // Persist to IndexedDB
    try {
      await saveToCache(STORES.COUPONS, currentStoreId, data);
    } catch {
      // Error handled silently
    }
  },

  // ============================================
  // Cache Management
  // ============================================

  /**
   * Update product lastSync timestamp for delta sync
   * Also persists to IndexedDB for cross-session delta sync
   */
  setProductsLastSync: async (timestamp: string) => {
    const currentStoreId = useStoreConfig.getState().currentStoreId;

    set((state) => {
      state.cache.products.lastSync = timestamp;
    });

    // Persist lastSync to IndexedDB for cross-session recovery
    if (currentStoreId) {
      try {
        await saveToCache(STORES.PRODUCTS, `${currentStoreId}_lastSync`, timestamp);
      } catch {
        // Error handled silently
      }
    }
  },

  /**
   * Get products lastSync timestamp
   */
  getProductsLastSync: (): string | null => {
    return get().cache.products.lastSync;
  },

  /**
   * Clear all cache (memory + IndexedDB)
   */
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

  /**
   * Clear cache for a specific type (including split caches)
   */
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

  /**
   * Check if cache is valid for a specific type
   */
  isCacheValid: (type: CacheType): boolean => {
    const state = get();
    const currentStoreId = useStoreConfig.getState().currentStoreId;
    const cached = state.cache[type];

    if (!cached.data || cached.storeId !== currentStoreId || !cached.timestamp) {
      return false;
    }

    const cacheExpiryTime = CACHE_EXPIRY[type.toUpperCase() as keyof typeof CACHE_EXPIRY] || CACHE_EXPIRY.DEFAULT;
    return Date.now() - cached.timestamp < cacheExpiryTime;
  },

  /**
   * Get cache age in seconds
   */
  getCacheAge: (type: CacheType): number | null => {
    const cached = get().cache[type];
    if (!cached.timestamp) return null;
    return Math.round((Date.now() - cached.timestamp) / 1000);
  },
})));

export default useCache;

// Export types for consumers
export type { CacheStore, CacheStoreState, CacheStoreActions, CacheType };
