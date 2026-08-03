import { vi } from 'vitest';
/**
 * Standard mock setups for Zustand stores used across tests.
 * Provides consistent store mocking patterns.
 */

import type { WooCommerceStore, WooCommerceOrder, WooCommerceProduct } from '../types';
import { createMockStore } from './mockFactories';

// ============================================
// Store Config Mock
// ============================================

export interface MockStoreConfigOptions {
  store?: WooCommerceStore | null;
  stores?: WooCommerceStore[];
}

/**
 * Create a mock implementation for useStoreConfig.
 * Returns a function that behaves like a Zustand selector hook.
 */
export function createStoreConfigMock(options: MockStoreConfigOptions = {}) {
  const store = options.store !== undefined ? options.store : createMockStore();
  const stores = options.stores || (store ? [store] : []);

  const state = {
    stores,
    currentStoreId: store?.id || null,
    getCurrentStore: () => store || undefined,
    addStore: vi.fn(),
    updateStore: vi.fn(),
    removeStore: vi.fn(),
    setCurrentStore: vi.fn(),
  };

  const mockHook = vi.fn((selector?: (s: typeof state) => unknown) => {
    return selector ? selector(state) : state;
  });

  // Add static methods
  Object.assign(mockHook, {
    getState: () => state,
    setState: vi.fn(),
  });

  return mockHook;
}

// ============================================
// Cache Mock
// ============================================

export interface MockCacheOptions {
  products?: WooCommerceProduct[] | null;
  orders?: WooCommerceOrder[] | null;
  storeId?: string | null;
}

export function createCacheMock(options: MockCacheOptions = {}) {
  const state = {
    cache: {
      products: {
        data: options.products || null,
        timestamp: options.products ? Date.now() : null,
        storeId: options.storeId || null,
        lastSync: null,
      },
      productsRecent: { data: null, timestamp: null, storeId: null },
      productsOld: { data: null, timestamp: null, storeId: null },
      orders: {
        data: options.orders || null,
        timestamp: options.orders ? Date.now() : null,
        storeId: options.storeId || null,
      },
      ordersRecent: { data: null, timestamp: null, storeId: null },
      ordersOld: { data: null, timestamp: null, storeId: null },
      customers: { data: null, timestamp: null, storeId: null },
      coupons: { data: null, timestamp: null, storeId: null },
    },
    getCachedData: vi.fn().mockResolvedValue(null),
    setCachedData: vi.fn().mockResolvedValue(undefined),
    clearCache: vi.fn().mockResolvedValue(undefined),
    clearCacheForType: vi.fn().mockResolvedValue(undefined),
  };

  const mockHook = vi.fn((selector?: (s: typeof state) => unknown) => {
    return selector ? selector(state) : state;
  });

  Object.assign(mockHook, {
    getState: () => state,
    setState: vi.fn(),
  });

  return mockHook;
}

// ============================================
// Settings Mock
// ============================================

export function createSettingsMock() {
  const state = {
    autoRefresh: false,
    autoRefreshInterval: 5,
    setAutoRefresh: vi.fn(),
    setAutoRefreshInterval: vi.fn(),
    refreshOrders: vi.fn(),
    refreshProducts: vi.fn(),
    refreshAll: vi.fn(),
  };

  const mockHook = vi.fn((selector?: (s: typeof state) => unknown) => {
    return selector ? selector(state) : state;
  });

  Object.assign(mockHook, {
    getState: () => state,
    setState: vi.fn(),
  });

  return mockHook;
}

// ============================================
// Toast Mock
// ============================================

export function createToastMock() {
  return {
    toasts: [],
    showToast: vi.fn(),
    removeToast: vi.fn(),
  };
}

// ============================================
// WooCommerce Service Mock
// ============================================

export function createWooCommerceServiceMock() {
  return vi.fn().mockImplementation(() => ({
    getOrder: vi.fn().mockResolvedValue({ success: true, data: {} }),
    getOrders: vi.fn().mockResolvedValue({ success: true, data: [] }),
    getAllOrders: vi.fn().mockResolvedValue({ success: true, data: [] }),
    updateOrder: vi.fn().mockResolvedValue({ success: true, data: {} }),
    createOrder: vi.fn().mockResolvedValue({ success: true, data: {} }),
    deleteOrder: vi.fn().mockResolvedValue({ success: true }),
    getOrderNotes: vi.fn().mockResolvedValue({ success: true, data: [] }),
    addOrderNote: vi.fn().mockResolvedValue({ success: true, data: {} }),
    deleteOrderNote: vi.fn().mockResolvedValue({ success: true }),
    getProduct: vi.fn().mockResolvedValue({ success: true, data: {} }),
    getProducts: vi.fn().mockResolvedValue({ success: true, data: [] }),
    getAllProducts: vi.fn().mockResolvedValue({ success: true, data: [] }),
    updateProduct: vi.fn().mockResolvedValue({ success: true, data: {} }),
    createProduct: vi.fn().mockResolvedValue({ success: true, data: {} }),
    deleteProduct: vi.fn().mockResolvedValue({ success: true }),
    batchUpdateProducts: vi.fn().mockResolvedValue({ success: true, data: { update: [] } }),
    getCustomers: vi.fn().mockResolvedValue({ success: true, data: [] }),
  }));
}
