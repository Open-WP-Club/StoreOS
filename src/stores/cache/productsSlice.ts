import type { StateCreator } from 'zustand';
import { saveToCache, getFromCache, STORES } from '../../utils/indexedDBCache';
import { CACHE_EXPIRY, TIME } from '../../constants/config';
import useStoreConfig from '../storeConfigStore';
import useSettings from '../settingsStore';
import type { WooCommerceProduct } from '../../types';
import type { CacheStore, ProductsSlice } from './types';

type Mutators = [['zustand/immer', never]];

/**
 * Products slice: split recent/old caching (see cacheStore.ts module docs
 * for the overall cache strategy).
 */
export const createProductsSlice: StateCreator<CacheStore, Mutators, [], ProductsSlice> = (set, get) => ({
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
        recentProducts = (await getFromCache(
          STORES.PRODUCTS,
          `${currentStoreId}_recent`,
          CACHE_EXPIRY.PRODUCTS_RECENT
        )) as WooCommerceProduct[] | null;
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
        oldProducts = (await getFromCache(
          STORES.PRODUCTS,
          `${currentStoreId}_old`,
          CACHE_EXPIRY.PRODUCTS_OLD
        )) as WooCommerceProduct[] | null;
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
        const savedLastSync = (await getFromCache(
          STORES.PRODUCTS,
          `${currentStoreId}_lastSync`,
          365 * 24 * 60 * 60 * 1000 // 1 year - lastSync should persist long
        )) as string | null;
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

  setCachedProducts: async (data: WooCommerceProduct[], currentStoreId: string, now: number) => {
    const recentProducts: WooCommerceProduct[] = [];
    const oldProducts: WooCommerceProduct[] = [];

    // Split products by modification date using configurable window
    const splitThreshold = useSettings.getState().orderSplitDays * TIME.DAY;
    for (const product of data) {
      const modifiedDate = new Date(
        product.date_modified_gmt || product.date_modified || product.date_created
      ).getTime();
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

  /** Update product lastSync timestamp for delta sync; also persists to IndexedDB. */
  setProductsLastSync: async (timestamp: string) => {
    const currentStoreId = useStoreConfig.getState().currentStoreId;

    set((state) => {
      state.cache.products.lastSync = timestamp;
    });

    if (currentStoreId) {
      try {
        await saveToCache(STORES.PRODUCTS, `${currentStoreId}_lastSync`, timestamp);
      } catch {
        // Error handled silently
      }
    }
  },

  getProductsLastSync: (): string | null => {
    return get().cache.products.lastSync;
  },
});
