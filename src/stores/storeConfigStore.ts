import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { WooCommerceStore, StoreLoadingSettings } from '../types';
import useActivityLog from './activityLogStore';

// ============================================
// Types
// ============================================

interface StoreConfigState {
  stores: WooCommerceStore[];
  currentStoreId: string | null;
}

interface NewStoreInput {
  name: string;
  url: string;
  consumerKey: string;
  consumerSecret: string;
  loadingSettings?: Partial<StoreLoadingSettings>;
  currency?: string;
  currencySymbol?: string;
}

interface StoreConfigActions {
  addStore: (store: NewStoreInput) => WooCommerceStore;
  updateStore: (id: string, updates: Partial<WooCommerceStore>) => void;
  removeStore: (id: string) => void;
  setCurrentStore: (id: string) => void;
  getCurrentStore: () => WooCommerceStore | undefined;
  getStoreById: (id: string) => WooCommerceStore | undefined;
  hasStores: () => boolean;
}

type StoreConfigStore = StoreConfigState & StoreConfigActions;

// ============================================
// Default Values
// ============================================

const DEFAULT_LOADING_SETTINGS: StoreLoadingSettings = {
  batchSize: 50,
  batchDelay: 500,
  posInfiniteScroll: true,
  retryDelaySeconds: 60,
};

// ============================================
// Store
// ============================================

/**
 * Store Configuration Store
 *
 * Manages WooCommerce store configurations (multi-store support).
 * Handles adding, updating, removing stores and tracking the current active store.
 */
const useStoreConfig = create<StoreConfigStore>()(
  persist(
    immer((set, get) => ({
      // State
      stores: [],
      currentStoreId: null,

      // Add a new WooCommerce store
      addStore: (store: NewStoreInput): WooCommerceStore => {
        const newStore: WooCommerceStore = {
          id: crypto.randomUUID(),
          name: store.name,
          url: store.url,
          consumerKey: store.consumerKey,
          consumerSecret: store.consumerSecret,
          createdAt: new Date().toISOString(),
          loadingSettings: {
            ...DEFAULT_LOADING_SETTINGS,
            ...store.loadingSettings,
          },
          currency: store.currency,
          currencySymbol: store.currencySymbol,
        };

        set((state) => {
          state.stores.push(newStore);
          if (!state.currentStoreId) state.currentStoreId = newStore.id;
        });

        useActivityLog.getState().logActivity({
          action: 'store_added',
          entityType: 'store',
          entityId: newStore.id,
          entityName: newStore.name,
          storeId: newStore.id,
          storeName: newStore.name,
          details: `Store "${newStore.name}" added (${newStore.url})`,
        });

        return newStore;
      },

      // Update store configuration
      updateStore: (id: string, updates: Partial<WooCommerceStore>) => {
        set((state) => {
          const store = state.stores.find((s) => s.id === id);
          if (store) Object.assign(store, updates);
        });
      },

      // Remove a store
      removeStore: (id: string) => {
        const storeToRemove = get().stores.find((s) => s.id === id);
        set((state) => {
          const index = state.stores.findIndex((s) => s.id === id);
          if (index !== -1) state.stores.splice(index, 1);
          if (state.currentStoreId === id) {
            state.currentStoreId = state.stores[0]?.id ?? null;
          }
        });
        if (storeToRemove) {
          useActivityLog.getState().logActivity({
            action: 'store_removed',
            entityType: 'store',
            entityId: id,
            entityName: storeToRemove.name,
            storeId: id,
            storeName: storeToRemove.name,
          });
        }
      },

      // Set current active store
      setCurrentStore: (id: string) => {
        set({ currentStoreId: id });
      },

      // Get current store object
      getCurrentStore: (): WooCommerceStore | undefined => {
        const state = get();
        return state.stores.find((store) => store.id === state.currentStoreId);
      },

      // Get store by ID
      getStoreById: (id: string): WooCommerceStore | undefined => {
        const state = get();
        return state.stores.find((store) => store.id === id);
      },

      // Check if any stores are configured
      hasStores: (): boolean => {
        return get().stores.length > 0;
      },
    })),
    {
      name: 'woocommerce-stores',
      // Explicitly use localStorage with JSON serialization
      storage: createJSONStorage(() => localStorage),
      partialize: (state): StoreConfigState => ({
        stores: state.stores,
        currentStoreId: state.currentStoreId,
      }),
    }
  )
);

export default useStoreConfig;

// Export types for consumers
export type { StoreConfigState, StoreConfigActions, StoreConfigStore, NewStoreInput };
