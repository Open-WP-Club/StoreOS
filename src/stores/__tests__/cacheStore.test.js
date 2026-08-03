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

describe('cacheStore', () => {
  const mockProducts = [
    {
      id: 1,
      name: 'Product 1',
      regular_price: '10.00',
      date_modified_gmt: new Date().toISOString(),
      date_modified: new Date().toISOString(),
      date_created: new Date().toISOString(),
    },
    {
      id: 2,
      name: 'Product 2',
      regular_price: '20.00',
      date_modified_gmt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), // 8 days old
      date_modified: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
      date_created: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];

  const mockOrders = [
    { id: 1, status: 'processing', date_created: new Date().toISOString() },
    { id: 2, status: 'completed', date_created: new Date().toISOString() },
    { id: 3, status: 'pending', date_created: new Date().toISOString() },
    { id: 4, status: 'cancelled', date_created: new Date().toISOString() },
  ];

  beforeEach(() => {
    // Reset cache state before each test
    useCache.setState({
      cache: {
        products: { data: null, timestamp: null, storeId: null, lastSync: null },
        productsRecent: { data: null, timestamp: null, storeId: null },
        productsOld: { data: null, timestamp: null, storeId: null },
        orders: { data: null, timestamp: null, storeId: null },
        ordersRecent: { data: null, timestamp: null, storeId: null },
        ordersOld: { data: null, timestamp: null, storeId: null },
      },
    });

    // Reset all mocks
    vi.clearAllMocks();

    // Mock IndexedDB functions
    indexedDBCache.saveToCache.mockResolvedValue(true);
    indexedDBCache.getFromCache.mockResolvedValue(null);
    indexedDBCache.clearCacheStore.mockResolvedValue(true);
    indexedDBCache.clearAllCache.mockResolvedValue(true);

    // Reset store config mock
    useStoreConfig.getState.mockReturnValue({ currentStoreId: 'test-store-1' });
  });

  describe('getCachedData', () => {
    it('should return null when no store is configured', async () => {
      useStoreConfig.getState.mockReturnValue({ currentStoreId: null });
      const { result } = renderHook(() => useCache());

      let cachedData;
      await act(async () => {
        cachedData = await result.current.getCachedData('products');
      });

      expect(cachedData).toBeNull();
    });

    it('should return null when cache is empty', async () => {
      const { result } = renderHook(() => useCache());

      let cachedData;
      await act(async () => {
        cachedData = await result.current.getCachedData('products');
      });

      expect(cachedData).toBeNull();
    });

    it('should return cached products from memory', async () => {
      const { result } = renderHook(() => useCache());

      await act(async () => {
        await result.current.setCachedData('products', mockProducts);
      });

      let cachedData;
      await act(async () => {
        cachedData = await result.current.getCachedData('products');
      });

      expect(cachedData).toHaveLength(2);
    });

    it('should return cached orders from memory', async () => {
      const { result } = renderHook(() => useCache());

      await act(async () => {
        await result.current.setCachedData('orders', mockOrders);
      });

      let cachedData;
      await act(async () => {
        cachedData = await result.current.getCachedData('orders');
      });

      expect(cachedData).toHaveLength(4);
    });
  });

  describe('setCachedData', () => {
    it('should not set cache when no store is configured', async () => {
      useStoreConfig.getState.mockReturnValue({ currentStoreId: null });
      const { result } = renderHook(() => useCache());

      await act(async () => {
        await result.current.setCachedData('products', mockProducts);
      });

      expect(result.current.cache.products.data).toBeNull();
      expect(indexedDBCache.saveToCache).not.toHaveBeenCalled();
    });

    it('should split products by modification date', async () => {
      const { result } = renderHook(() => useCache());

      await act(async () => {
        await result.current.setCachedData('products', mockProducts);
      });

      // Recent products (modified < 7 days ago)
      expect(result.current.cache.productsRecent.data).toBeDefined();
      // Old products (modified >= 7 days ago)
      expect(result.current.cache.productsOld.data).toBeDefined();
      // Combined products
      expect(result.current.cache.products.data).toHaveLength(2);
    });

    it('should split orders by status', async () => {
      const { result } = renderHook(() => useCache());

      await act(async () => {
        await result.current.setCachedData('orders', mockOrders);
      });

      // Active orders (processing, pending)
      expect(result.current.cache.ordersRecent.data).toHaveLength(2);
      // Final orders (completed, cancelled)
      expect(result.current.cache.ordersOld.data).toHaveLength(2);
      // Combined orders
      expect(result.current.cache.orders.data).toHaveLength(4);
    });

    it('should save to IndexedDB', async () => {
      const { result } = renderHook(() => useCache());

      await act(async () => {
        await result.current.setCachedData('products', mockProducts);
      });

      expect(indexedDBCache.saveToCache).toHaveBeenCalled();
    });

    it('should set correct storeId in cache', async () => {
      const { result } = renderHook(() => useCache());

      await act(async () => {
        await result.current.setCachedData('products', mockProducts);
      });

      expect(result.current.cache.products.storeId).toBe('test-store-1');
    });
  });

  describe('setCachedOrders', () => {
    it('should categorize orders by status correctly', async () => {
      const { result } = renderHook(() => useCache());

      const orders = [
        { id: 1, status: 'processing' },
        { id: 2, status: 'pending' },
        { id: 3, status: 'on-hold' },
        { id: 4, status: 'completed' },
        { id: 5, status: 'cancelled' },
        { id: 6, status: 'refunded' },
        { id: 7, status: 'failed' },
        { id: 8, status: 'trash' },
      ];

      await act(async () => {
        await result.current.setCachedData('orders', orders);
      });

      // Active orders: processing, pending, on-hold
      expect(result.current.cache.ordersRecent.data).toHaveLength(3);
      // Final orders: completed, cancelled, refunded, failed, trash
      expect(result.current.cache.ordersOld.data).toHaveLength(5);
    });
  });

  describe('clearCache', () => {
    it('should clear all cache data', async () => {
      const { result } = renderHook(() => useCache());

      await act(async () => {
        await result.current.setCachedData('products', mockProducts);
        await result.current.setCachedData('orders', mockOrders);
      });

      expect(result.current.cache.products.data).not.toBeNull();
      expect(result.current.cache.orders.data).not.toBeNull();

      await act(async () => {
        await result.current.clearCache();
      });

      expect(result.current.cache.products.data).toBeNull();
      expect(result.current.cache.orders.data).toBeNull();
      expect(result.current.cache.productsRecent.data).toBeNull();
      expect(result.current.cache.productsOld.data).toBeNull();
      expect(result.current.cache.ordersRecent.data).toBeNull();
      expect(result.current.cache.ordersOld.data).toBeNull();
      expect(indexedDBCache.clearAllCache).toHaveBeenCalled();
    });
  });

  describe('clearCacheForType', () => {
    it('should clear only products cache', async () => {
      const { result } = renderHook(() => useCache());

      await act(async () => {
        await result.current.setCachedData('products', mockProducts);
        await result.current.setCachedData('orders', mockOrders);
      });

      await act(async () => {
        await result.current.clearCacheForType('products');
      });

      expect(result.current.cache.products.data).toBeNull();
      expect(result.current.cache.productsRecent.data).toBeNull();
      expect(result.current.cache.productsOld.data).toBeNull();
      expect(result.current.cache.orders.data).not.toBeNull();
    });

    it('should clear only orders cache', async () => {
      const { result } = renderHook(() => useCache());

      await act(async () => {
        await result.current.setCachedData('products', mockProducts);
        await result.current.setCachedData('orders', mockOrders);
      });

      await act(async () => {
        await result.current.clearCacheForType('orders');
      });

      expect(result.current.cache.orders.data).toBeNull();
      expect(result.current.cache.ordersRecent.data).toBeNull();
      expect(result.current.cache.ordersOld.data).toBeNull();
      expect(result.current.cache.products.data).not.toBeNull();
    });

    it('should call clearCacheStore for IndexedDB', async () => {
      const { result } = renderHook(() => useCache());

      await act(async () => {
        await result.current.clearCacheForType('products');
      });

      expect(indexedDBCache.clearCacheStore).toHaveBeenCalled();
    });
  });

  describe('isCacheValid', () => {
    it('should return false when cache is empty', () => {
      const { result } = renderHook(() => useCache());

      expect(result.current.isCacheValid('products')).toBe(false);
    });

    it('should return false when cache storeId does not match', async () => {
      const { result } = renderHook(() => useCache());

      await act(async () => {
        await result.current.setCachedData('products', mockProducts);
      });

      useStoreConfig.getState.mockReturnValue({ currentStoreId: 'different-store' });

      expect(result.current.isCacheValid('products')).toBe(false);
    });

    it('should return true for valid cache', async () => {
      const { result } = renderHook(() => useCache());

      await act(async () => {
        await result.current.setCachedData('products', mockProducts);
      });

      expect(result.current.isCacheValid('products')).toBe(true);
    });
  });

  describe('getCacheAge', () => {
    it('should return null when cache has no timestamp', () => {
      const { result } = renderHook(() => useCache());

      expect(result.current.getCacheAge('products')).toBeNull();
    });

    it('should return age in seconds', async () => {
      const { result } = renderHook(() => useCache());

      await act(async () => {
        await result.current.setCachedData('products', mockProducts);
      });

      const age = result.current.getCacheAge('products');
      expect(age).toBeGreaterThanOrEqual(0);
      expect(age).toBeLessThan(10); // Should be very recent
    });
  });

  describe('setProductsLastSync', () => {
    it('should set lastSync timestamp', async () => {
      const { result } = renderHook(() => useCache());
      const timestamp = new Date().toISOString();

      await act(async () => {
        await result.current.setProductsLastSync(timestamp);
      });

      expect(result.current.cache.products.lastSync).toBe(timestamp);
    });

    it('should persist lastSync to IndexedDB', async () => {
      const { result } = renderHook(() => useCache());
      const timestamp = new Date().toISOString();

      await act(async () => {
        await result.current.setProductsLastSync(timestamp);
      });

      expect(indexedDBCache.saveToCache).toHaveBeenCalledWith(
        expect.anything(),
        'test-store-1_lastSync',
        timestamp
      );
    });
  });

  describe('getProductsLastSync', () => {
    it('should return null when no lastSync is set', () => {
      const { result } = renderHook(() => useCache());

      expect(result.current.getProductsLastSync()).toBeNull();
    });

    it('should return lastSync timestamp', async () => {
      const { result } = renderHook(() => useCache());
      const timestamp = new Date().toISOString();

      await act(async () => {
        await result.current.setProductsLastSync(timestamp);
      });

      expect(result.current.getProductsLastSync()).toBe(timestamp);
    });
  });

  describe('getCachedProducts', () => {
    it('should merge recent and old products', async () => {
      const { result } = renderHook(() => useCache());

      await act(async () => {
        await result.current.setCachedData('products', mockProducts);
      });

      let cachedProducts;
      await act(async () => {
        cachedProducts = await result.current.getCachedProducts('test-store-1');
      });

      expect(cachedProducts).toHaveLength(2);
    });

    it('should try IndexedDB when memory cache is empty', async () => {
      indexedDBCache.getFromCache.mockResolvedValue(mockProducts);
      const { result } = renderHook(() => useCache());

      await act(async () => {
        await result.current.getCachedProducts('test-store-1');
      });

      expect(indexedDBCache.getFromCache).toHaveBeenCalled();
    });
  });

  describe('getCachedOrders', () => {
    it('should merge recent and old orders', async () => {
      const { result } = renderHook(() => useCache());

      await act(async () => {
        await result.current.setCachedData('orders', mockOrders);
      });

      let cachedOrders;
      await act(async () => {
        cachedOrders = await result.current.getCachedOrders('test-store-1');
      });

      expect(cachedOrders).toHaveLength(4);
    });

    it('should try IndexedDB when memory cache is empty', async () => {
      indexedDBCache.getFromCache.mockResolvedValue(mockOrders);
      const { result } = renderHook(() => useCache());

      await act(async () => {
        await result.current.getCachedOrders('test-store-1');
      });

      expect(indexedDBCache.getFromCache).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle IndexedDB save errors gracefully', async () => {
      indexedDBCache.saveToCache.mockRejectedValue(new Error('IndexedDB error'));
      const { result } = renderHook(() => useCache());

      // Should not throw
      await act(async () => {
        await result.current.setCachedData('products', mockProducts);
      });

      // Memory cache should still be set
      expect(result.current.cache.products.data).toHaveLength(2);
    });

    it('should handle IndexedDB clear errors gracefully', async () => {
      indexedDBCache.clearAllCache.mockRejectedValue(new Error('IndexedDB error'));
      const { result } = renderHook(() => useCache());

      await act(async () => {
        await result.current.setCachedData('products', mockProducts);
      });

      // Should not throw
      await act(async () => {
        await result.current.clearCache();
      });

      // Memory cache should still be cleared
      expect(result.current.cache.products.data).toBeNull();
    });

    it('should handle IndexedDB read errors gracefully', async () => {
      indexedDBCache.getFromCache.mockRejectedValue(new Error('IndexedDB error'));
      const { result } = renderHook(() => useCache());

      let cachedData;
      await act(async () => {
        cachedData = await result.current.getCachedProducts('test-store-1');
      });

      // Should return null on error
      expect(cachedData).toBeNull();
    });
  });
});
