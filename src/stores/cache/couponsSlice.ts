import type { StateCreator } from 'zustand';
import { getCollection, STORES } from '../../utils/indexedDBCache';
import { CACHE_EXPIRY } from '../../constants/config';
import type { WooCommerceCoupon } from '../../types';
import { persistCollection } from './persist';
import type { CacheStore, CouponsSlice } from './types';

type Mutators = [['zustand/immer', never]];

export const createCouponsSlice: StateCreator<CacheStore, Mutators, [], CouponsSlice> = (set, get) => ({
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
      const coupons = (await getCollection(
        STORES.COUPONS,
        currentStoreId,
        CACHE_EXPIRY.COUPONS
      )) as WooCommerceCoupon[] | null;
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

  setCachedCoupons: async (data: WooCommerceCoupon[], currentStoreId: string, now: number) => {
    const prevEntry = get().cache.coupons;
    const prev = prevEntry.storeId === currentStoreId ? prevEntry.data : null;
    set((state) => {
      state.cache.coupons = { data, timestamp: now, storeId: currentStoreId };
    });

    try {
      await persistCollection(STORES.COUPONS, currentStoreId, prev, data);
    } catch {
      // Error handled silently
    }
  },
});
