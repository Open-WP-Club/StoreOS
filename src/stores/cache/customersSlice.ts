import type { StateCreator } from 'zustand';
import { getCollection, STORES } from '../../utils/indexedDBCache';
import { CACHE_EXPIRY } from '../../constants/config';
import type { WooCommerceCustomer } from '../../types';
import { persistCollection } from './persist';
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
      const customers = (await getCollection(
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
    const prevEntry = get().cache.customers;
    const prev = prevEntry.storeId === currentStoreId ? prevEntry.data : null;
    set((state) => {
      state.cache.customers = { data, timestamp: now, storeId: currentStoreId };
    });

    try {
      await persistCollection(STORES.CUSTOMERS, currentStoreId, prev, data);
    } catch {
      // Error handled silently
    }
  },
});
