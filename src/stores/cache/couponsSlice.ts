import type { StateCreator } from 'zustand';
import { saveToCache, getFromCache, STORES } from '../../utils/indexedDBCache';
import { CACHE_EXPIRY } from '../../constants/config';
import type { WooCommerceCoupon } from '../../types';
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
      const coupons = (await getFromCache(
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
    set((state) => {
      state.cache.coupons = { data, timestamp: now, storeId: currentStoreId };
    });

    try {
      await saveToCache(STORES.COUPONS, currentStoreId, data);
    } catch {
      // Error handled silently
    }
  },
});
