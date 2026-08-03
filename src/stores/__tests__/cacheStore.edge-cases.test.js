import { vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useCache from '../cacheStore';
import * as indexedDBCache from '../../utils/indexedDBCache';
import useStoreConfig from '../storeConfigStore';

// Mock the indexedDBCache module
vi.mock('../../utils/indexedDBCache');

// Mock the storeConfigStore module
vi.mock('../storeConfigStore', () => ({
  __esModule: true,
  default: {
    getState: vi.fn(() => ({
      currentStoreId: 'test-store-1',
    })),
  },
}));

describe('cacheStore - edge cases', () => {
  const mockCustomers = [
    { id: 1, first_name: 'John', last_name: 'Doe', email: 'john@example.com' },
    { id: 2, first_name: 'Jane', last_name: 'Smith', email: 'jane@example.com' },
  ];

  const mockCoupons = [
    { id: 1, code: 'SAVE10', amount: '10', discount_type: 'percent' },
    { id: 2, code: 'FLAT20', amount: '20', discount_type: 'fixed_cart' },
  ];

  beforeEach(() => {
    useCache.setState({
      cache: {
        products: { data: null, timestamp: null, storeId: null, lastSync: null },
        productsRecent: { data: null, timestamp: null, storeId: null },
        productsOld: { data: null, timestamp: null, storeId: null },
        orders: { data: null, timestamp: null, storeId: null },
        ordersRecent: { data: null, timestamp: null, storeId: null },
        ordersOld: { data: null, timestamp: null, storeId: null },
        customers: { data: null, timestamp: null, storeId: null },
        coupons: { data: null, timestamp: null, storeId: null },
      },
    });

    vi.clearAllMocks();

    indexedDBCache.saveToCache.mockResolvedValue(true);
    indexedDBCache.getFromCache.mockResolvedValue(null);
    indexedDBCache.clearCacheStore.mockResolvedValue(true);
    indexedDBCache.clearAllCache.mockResolvedValue(true);

    useStoreConfig.getState.mockReturnValue({ currentStoreId: 'test-store-1' });
  });

  // ============================================
  // Customers cache
  // ============================================

  describe('getCachedCustomers', () => {
    it('should return null when no customers are cached', async () => {
      const { result } = renderHook(() => useCache());

      let cached;
      await act(async () => {
        cached = await result.current.getCachedCustomers('test-store-1');
      });

      expect(cached).toBeNull();
    });

    it('should return customers from memory cache when valid', async () => {
      const { result } = renderHook(() => useCache());

      await act(async () => {
        await result.current.setCachedCustomers(mockCustomers, 'test-store-1', Date.now());
      });

      let cached;
      await act(async () => {
        cached = await result.current.getCachedCustomers('test-store-1');
      });

      expect(cached).toHaveLength(2);
      expect(cached[0].first_name).toBe('John');
    });

    it('should fallback to IndexedDB when memory is empty', async () => {
      indexedDBCache.getFromCache.mockResolvedValue(mockCustomers);
      const { result } = renderHook(() => useCache());

      let cached;
      await act(async () => {
        cached = await result.current.getCachedCustomers('test-store-1');
      });

      expect(indexedDBCache.getFromCache).toHaveBeenCalled();
      expect(cached).toHaveLength(2);
    });

    it('should return null when store ID does not match', async () => {
      const { result } = renderHook(() => useCache());

      await act(async () => {
        await result.current.setCachedCustomers(mockCustomers, 'other-store', Date.now());
      });

      let cached;
      await act(async () => {
        cached = await result.current.getCachedCustomers('test-store-1');
      });

      // Memory miss (different storeId), falls to IndexedDB which returns null
      expect(cached).toBeNull();
    });

    it('should handle IndexedDB read error gracefully', async () => {
      indexedDBCache.getFromCache.mockRejectedValue(new Error('DB error'));
      const { result } = renderHook(() => useCache());

      let cached;
      await act(async () => {
        cached = await result.current.getCachedCustomers('test-store-1');
      });

      expect(cached).toBeNull();
    });
  });

  describe('setCachedCustomers', () => {
    it('should store customers in memory and IndexedDB', async () => {
      const { result } = renderHook(() => useCache());

      await act(async () => {
        await result.current.setCachedCustomers(mockCustomers, 'test-store-1', Date.now());
      });

      expect(result.current.cache.customers.data).toHaveLength(2);
      expect(result.current.cache.customers.storeId).toBe('test-store-1');
      expect(indexedDBCache.saveToCache).toHaveBeenCalledWith(
        expect.anything(),
        'test-store-1',
        mockCustomers
      );
    });

    it('should handle IndexedDB save error gracefully', async () => {
      indexedDBCache.saveToCache.mockRejectedValue(new Error('Save failed'));
      const { result } = renderHook(() => useCache());

      await act(async () => {
        await result.current.setCachedCustomers(mockCustomers, 'test-store-1', Date.now());
      });

      // Memory cache should still be set
      expect(result.current.cache.customers.data).toHaveLength(2);
    });
  });

  // ============================================
  // Coupons cache
  // ============================================

  describe('getCachedCoupons', () => {
    it('should return null when no coupons are cached', async () => {
      const { result } = renderHook(() => useCache());

      let cached;
      await act(async () => {
        cached = await result.current.getCachedCoupons('test-store-1');
      });

      expect(cached).toBeNull();
    });

    it('should return coupons from memory cache when valid', async () => {
      const { result } = renderHook(() => useCache());

      await act(async () => {
        await result.current.setCachedCoupons(mockCoupons, 'test-store-1', Date.now());
      });

      let cached;
      await act(async () => {
        cached = await result.current.getCachedCoupons('test-store-1');
      });

      expect(cached).toHaveLength(2);
      expect(cached[0].code).toBe('SAVE10');
    });

    it('should fallback to IndexedDB when memory is empty', async () => {
      indexedDBCache.getFromCache.mockResolvedValue(mockCoupons);
      const { result } = renderHook(() => useCache());

      let cached;
      await act(async () => {
        cached = await result.current.getCachedCoupons('test-store-1');
      });

      expect(indexedDBCache.getFromCache).toHaveBeenCalled();
      expect(cached).toHaveLength(2);
    });

    it('should handle IndexedDB read error gracefully', async () => {
      indexedDBCache.getFromCache.mockRejectedValue(new Error('DB error'));
      const { result } = renderHook(() => useCache());

      let cached;
      await act(async () => {
        cached = await result.current.getCachedCoupons('test-store-1');
      });

      expect(cached).toBeNull();
    });
  });

  describe('setCachedCoupons', () => {
    it('should store coupons in memory and IndexedDB', async () => {
      const { result } = renderHook(() => useCache());

      await act(async () => {
        await result.current.setCachedCoupons(mockCoupons, 'test-store-1', Date.now());
      });

      expect(result.current.cache.coupons.data).toHaveLength(2);
      expect(result.current.cache.coupons.storeId).toBe('test-store-1');
      expect(indexedDBCache.saveToCache).toHaveBeenCalledWith(
        expect.anything(),
        'test-store-1',
        mockCoupons
      );
    });
  });

  // ============================================
  // getCachedData routing
  // ============================================

  describe('getCachedData - type routing', () => {
    it('should route customers type correctly', async () => {
      const { result } = renderHook(() => useCache());

      await act(async () => {
        await result.current.setCachedData('customers', mockCustomers);
      });

      let cached;
      await act(async () => {
        cached = await result.current.getCachedData('customers');
      });

      expect(cached).toHaveLength(2);
    });

    it('should route coupons type correctly', async () => {
      const { result } = renderHook(() => useCache());

      await act(async () => {
        await result.current.setCachedData('coupons', mockCoupons);
      });

      let cached;
      await act(async () => {
        cached = await result.current.getCachedData('coupons');
      });

      expect(cached).toHaveLength(2);
    });
  });

  // ============================================
  // clearCacheForType
  // ============================================

  describe('clearCacheForType - customers and coupons', () => {
    it('should clear only customers cache', async () => {
      const { result } = renderHook(() => useCache());

      await act(async () => {
        await result.current.setCachedData('customers', mockCustomers);
        await result.current.setCachedData('coupons', mockCoupons);
      });

      await act(async () => {
        await result.current.clearCacheForType('customers');
      });

      expect(result.current.cache.customers.data).toBeNull();
      expect(result.current.cache.coupons.data).not.toBeNull();
    });

    it('should clear only coupons cache', async () => {
      const { result } = renderHook(() => useCache());

      await act(async () => {
        await result.current.setCachedData('customers', mockCustomers);
        await result.current.setCachedData('coupons', mockCoupons);
      });

      await act(async () => {
        await result.current.clearCacheForType('coupons');
      });

      expect(result.current.cache.coupons.data).toBeNull();
      expect(result.current.cache.customers.data).not.toBeNull();
    });

    it('should handle IndexedDB clearCacheStore error gracefully', async () => {
      indexedDBCache.clearCacheStore.mockRejectedValue(new Error('Clear failed'));
      const { result } = renderHook(() => useCache());

      await act(async () => {
        await result.current.setCachedData('coupons', mockCoupons);
      });

      await act(async () => {
        await result.current.clearCacheForType('coupons');
      });

      // Memory cache should still be cleared
      expect(result.current.cache.coupons.data).toBeNull();
    });
  });

  // ============================================
  // isCacheValid and getCacheAge
  // ============================================

  describe('isCacheValid - customers and coupons', () => {
    it('should validate customers cache', async () => {
      const { result } = renderHook(() => useCache());

      expect(result.current.isCacheValid('customers')).toBe(false);

      await act(async () => {
        await result.current.setCachedData('customers', mockCustomers);
      });

      expect(result.current.isCacheValid('customers')).toBe(true);
    });

    it('should validate coupons cache', async () => {
      const { result } = renderHook(() => useCache());

      expect(result.current.isCacheValid('coupons')).toBe(false);

      await act(async () => {
        await result.current.setCachedData('coupons', mockCoupons);
      });

      expect(result.current.isCacheValid('coupons')).toBe(true);
    });
  });

  describe('getCacheAge - customers and coupons', () => {
    it('should return age for customers cache', async () => {
      const { result } = renderHook(() => useCache());

      expect(result.current.getCacheAge('customers')).toBeNull();

      await act(async () => {
        await result.current.setCachedData('customers', mockCustomers);
      });

      const age = result.current.getCacheAge('customers');
      expect(age).toBeGreaterThanOrEqual(0);
      expect(age).toBeLessThan(10);
    });

    it('should return age for coupons cache', async () => {
      const { result } = renderHook(() => useCache());

      await act(async () => {
        await result.current.setCachedData('coupons', mockCoupons);
      });

      const age = result.current.getCacheAge('coupons');
      expect(age).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================
  // setProductsLastSync edge cases
  // ============================================

  describe('setProductsLastSync - edge cases', () => {
    it('should not persist to IndexedDB when no store is configured', async () => {
      useStoreConfig.getState.mockReturnValue({ currentStoreId: null });
      const { result } = renderHook(() => useCache());

      await act(async () => {
        await result.current.setProductsLastSync('2025-01-01T00:00:00.000Z');
      });

      // Should still set in memory
      expect(result.current.cache.products.lastSync).toBe('2025-01-01T00:00:00.000Z');
      // But should not call IndexedDB save
      expect(indexedDBCache.saveToCache).not.toHaveBeenCalled();
    });

    it('should handle IndexedDB save error for lastSync gracefully', async () => {
      indexedDBCache.saveToCache.mockRejectedValue(new Error('Save failed'));
      const { result } = renderHook(() => useCache());

      await act(async () => {
        await result.current.setProductsLastSync('2025-01-01T00:00:00.000Z');
      });

      // Memory should still be set
      expect(result.current.cache.products.lastSync).toBe('2025-01-01T00:00:00.000Z');
    });
  });

  // ============================================
  // clearCache includes customers and coupons
  // ============================================

  describe('clearCache - includes all types', () => {
    it('should clear customers and coupons along with products and orders', async () => {
      const { result } = renderHook(() => useCache());

      await act(async () => {
        await result.current.setCachedData('customers', mockCustomers);
        await result.current.setCachedData('coupons', mockCoupons);
      });

      expect(result.current.cache.customers.data).not.toBeNull();
      expect(result.current.cache.coupons.data).not.toBeNull();

      await act(async () => {
        await result.current.clearCache();
      });

      expect(result.current.cache.customers.data).toBeNull();
      expect(result.current.cache.coupons.data).toBeNull();
    });
  });
});
