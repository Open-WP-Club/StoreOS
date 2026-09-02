import type { StateCreator } from 'zustand';
import { saveToCache, getFromCache, STORES } from '../../utils/indexedDBCache';
import { CACHE_EXPIRY } from '../../constants/config';
import type { WooCommerceCustomer } from '../../types';
import type { CacheStore, CustomersSlice } from './types';

type Mutators = [['zustand/immer', never]];

export const createCustomersSlice: StateCreator<CacheStore, Mutators, [], CustomersSlice> = (set, get) => ({
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
      const customers = (await getFromCache(
        STORES.CUSTOMERS,
        currentStoreId,
        CACHE_EXPIRY.CUSTOMERS
      )) as WooCommerceCustomer[] | null;
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

  setCachedCustomers: async (data: WooCommerceCustomer[], currentStoreId: string, now: number) => {
    set((state) => {
      state.cache.customers = { data, timestamp: now, storeId: currentStoreId };
    });

    try {
      await saveToCache(STORES.CUSTOMERS, currentStoreId, data);
    } catch {
      // Error handled silently
    }
  },
});
