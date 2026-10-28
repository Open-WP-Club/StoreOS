import type { StateCreator } from 'zustand';
import { getCollection, saveToCache, getFromCache, STORES } from '../../utils/indexedDBCache';
import { CACHE_EXPIRY } from '../../constants/config';
import type { WooCommerceOrder } from '../../types';
import type { CacheStore, OrdersSlice, OrdersSync } from './types';
import { persistCollection } from './persist';

type Mutators = [['zustand/immer', never]];

const FINAL_STATUSES = ['completed', 'cancelled', 'refunded', 'failed', 'trash'];

/**
 * Orders slice: split active/final caching (see cacheStore.ts module docs
 * for the overall cache strategy).
 */
export const createOrdersSlice: StateCreator<CacheStore, Mutators, [], OrdersSlice> = (set, get) => ({
  saveOrdersSync: async (storeId, sync) => {
    try {
      await saveToCache(STORES.ORDERS, `${storeId}_lastSync`, sync);
    } catch {
      // Best effort: next start just does a full load
    }
  },

  loadOrdersSync: async (storeId) => {
    try {
      // 1 year: the cursor must outlive the orders data TTL; the 1h full re-sync bounds staleness
      return (await getFromCache(
        STORES.ORDERS,
        `${storeId}_lastSync`,
        365 * 24 * 60 * 60 * 1000
      )) as OrdersSync | null;
    } catch {
      return null;
    }
  },

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
        recentOrders = (await getCollection(
          STORES.ORDERS,
          `${currentStoreId}_recent`,
          CACHE_EXPIRY.ORDERS_RECENT
        )) as WooCommerceOrder[] | null;
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
        oldOrders = (await getCollection(
          STORES.ORDERS,
          `${currentStoreId}_old`,
          CACHE_EXPIRY.ORDERS_COMPLETED
        )) as WooCommerceOrder[] | null;
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
   * Final status orders (completed, cancelled, refunded, failed, trash) get longer cache.
   * Active orders (pending, processing, on-hold) need frequent updates.
   */
  setCachedOrders: async (data: WooCommerceOrder[], currentStoreId: string, now: number) => {
    const activeOrders: WooCommerceOrder[] = [];
    const finalOrders: WooCommerceOrder[] = [];

    for (const order of data) {
      if (FINAL_STATUSES.includes(order.status)) {
        finalOrders.push(order);
      } else {
        activeOrders.push(order);
      }
    }

    const prev = get().cache;
    const prevRecent = prev.ordersRecent.storeId === currentStoreId ? prev.ordersRecent.data : null;
    const prevOld = prev.ordersOld.storeId === currentStoreId ? prev.ordersOld.data : null;

    // ordersRecent = active orders (short cache); ordersOld = final orders (long cache)
    set((state) => {
      state.cache.orders = { data, timestamp: now, storeId: currentStoreId };
      state.cache.ordersRecent = { data: activeOrders, timestamp: now, storeId: currentStoreId };
      state.cache.ordersOld = { data: finalOrders, timestamp: now, storeId: currentStoreId };
    });

    // Persist to IndexedDB
    try {
      await Promise.all([
        persistCollection(STORES.ORDERS, `${currentStoreId}_recent`, prevRecent, activeOrders),
        persistCollection(STORES.ORDERS, `${currentStoreId}_old`, prevOld, finalOrders),
      ]);
    } catch {
      // Error handled silently
    }
  },
});
