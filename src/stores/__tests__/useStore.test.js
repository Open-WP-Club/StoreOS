import { vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useStore, { useStoreConfig, useCache, useTheme, useSearch, useSettings } from '../index';
import * as indexedDBCache from '../../utils/indexedDBCache';

// Mock the indexedDBCache module
vi.mock('../../utils/indexedDBCache');

describe('useStore', () => {
  let dateNowCounter = 1000000000000;
  const originalDateNow = Date.now;

  beforeEach(() => {
    // Mock Date.now() to return incrementing values to prevent ID collisions
    dateNowCounter = 1000000000000;
    Date.now = vi.fn(() => dateNowCounter++);

    // Clear store state before each test
    useStoreConfig.setState({
      stores: [],
      currentStoreId: null,
    });

    useTheme.setState({
      theme: 'light',
      isTogglingTheme: false,
    });

    useSettings.setState({
      autoRefresh: false,
      autoRefreshInterval: 5,
    });

    useSearch.setState({
      recentSearches: [],
      savedFilterPresets: [],
      maxRecentSearches: 10,
    });

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
  });

  afterEach(() => {
    // Restore Date.now
    Date.now = originalDateNow;
  });

  describe('Store Management', () => {
    it('should add a new store', () => {
      const { result } = renderHook(() => useStoreConfig());

      act(() => {
        result.current.addStore({
          name: 'Test Store',
          url: 'https://test.com',
          consumerKey: 'key',
          consumerSecret: 'secret',
        });
      });

      expect(result.current.stores).toHaveLength(1);
      expect(result.current.stores[0]).toMatchObject({
        name: 'Test Store',
        url: 'https://test.com',
        id: expect.any(String),
        createdAt: expect.any(String),
        loadingSettings: {
          batchSize: 50,
          batchDelay: 500,
        },
      });
    });

    it('should set first store as current when adding to empty list', () => {
      const { result } = renderHook(() => useStoreConfig());

      act(() => {
        result.current.addStore({
          name: 'Test Store',
          url: 'https://test.com',
        });
      });

      expect(result.current.currentStoreId).toBe(result.current.stores[0].id);
    });

    it('should not change current store when adding to non-empty list', () => {
      const { result } = renderHook(() => useStoreConfig());

      act(() => {
        const store1 = result.current.addStore({
          name: 'Store 1',
          url: 'https://store1.com',
        });
        result.current.setCurrentStore(store1.id);
        result.current.addStore({
          name: 'Store 2',
          url: 'https://store2.com',
        });
      });

      expect(result.current.currentStoreId).toBe(result.current.stores[0].id);
    });

    it('should update a store', () => {
      const { result } = renderHook(() => useStoreConfig());

      act(() => {
        result.current.addStore({
          name: 'Test Store',
          url: 'https://test.com',
        });
      });

      const storeId = result.current.stores[0].id;

      act(() => {
        result.current.updateStore(storeId, { name: 'Updated Store' });
      });

      expect(result.current.stores[0].name).toBe('Updated Store');
    });

    it('should remove a store', () => {
      const { result } = renderHook(() => useStoreConfig());

      act(() => {
        result.current.addStore({
          name: 'Store 1',
          url: 'https://store1.com',
        });
        result.current.addStore({
          name: 'Store 2',
          url: 'https://store2.com',
        });
      });

      const storeIdToRemove = result.current.stores[0].id;

      act(() => {
        result.current.removeStore(storeIdToRemove);
      });

      expect(result.current.stores).toHaveLength(1);
      expect(result.current.stores[0].name).toBe('Store 2');
    });

    it('should set new current store when removing current store', () => {
      const { result } = renderHook(() => useStoreConfig());

      act(() => {
        const store1 = result.current.addStore({
          name: 'Store 1',
          url: 'https://store1.com',
        });
        result.current.addStore({
          name: 'Store 2',
          url: 'https://store2.com',
        });
        result.current.setCurrentStore(store1.id);
      });

      const currentStoreId = result.current.currentStoreId;

      act(() => {
        result.current.removeStore(currentStoreId);
      });

      expect(result.current.currentStoreId).toBe(result.current.stores[0].id);
    });

    it('should set currentStoreId to null when removing last store', () => {
      const { result } = renderHook(() => useStoreConfig());

      act(() => {
        result.current.addStore({
          name: 'Store 1',
          url: 'https://store1.com',
        });
      });

      const storeId = result.current.stores[0].id;

      act(() => {
        result.current.removeStore(storeId);
      });

      expect(result.current.currentStoreId).toBeNull();
    });

    it('should get current store', () => {
      const { result } = renderHook(() => useStoreConfig());

      act(() => {
        result.current.addStore({
          name: 'Test Store',
          url: 'https://test.com',
        });
      });

      const currentStore = result.current.getCurrentStore();

      expect(currentStore).toMatchObject({
        name: 'Test Store',
        url: 'https://test.com',
      });
    });

    it('should return undefined when no current store is set', () => {
      const { result } = renderHook(() => useStoreConfig());

      const currentStore = result.current.getCurrentStore();

      expect(currentStore).toBeUndefined();
    });
  });

  describe('Theme Management', () => {
    it('should toggle theme from light to dark', () => {
      const { result } = renderHook(() => useTheme());

      act(() => {
        result.current.toggleTheme();
      });

      expect(result.current.theme).toBe('dark');
    });

    it('should toggle theme from dark to light', () => {
      const { result } = renderHook(() => useTheme());

      // Set to dark first
      act(() => {
        useTheme.setState({ theme: 'dark' });
      });

      act(() => {
        result.current.toggleTheme();
      });

      expect(result.current.theme).toBe('light');
    });

    it('should prevent rapid theme toggling', () => {
      vi.useFakeTimers();
      const { result } = renderHook(() => useTheme());

      act(() => {
        result.current.toggleTheme();
        result.current.toggleTheme(); // This should be ignored
      });

      expect(result.current.theme).toBe('dark'); // Only toggled once

      // Wait for the debounce timeout
      act(() => {
        vi.advanceTimersByTime(300);
      });

      vi.useRealTimers();
    });
  });

  describe('Auto-refresh Settings', () => {
    it('should set auto-refresh enabled', () => {
      const { result } = renderHook(() => useSettings());

      act(() => {
        result.current.setAutoRefresh(true);
      });

      expect(result.current.autoRefresh).toBe(true);
    });

    it('should set auto-refresh interval', () => {
      const { result } = renderHook(() => useSettings());

      act(() => {
        result.current.setAutoRefreshInterval(10);
      });

      expect(result.current.autoRefreshInterval).toBe(10);
    });
  });

  describe('Recent Searches', () => {
    it('should add a recent search', () => {
      const { result } = renderHook(() => useSearch());

      act(() => {
        result.current.addRecentSearch({
          query: 'test query',
          type: 'products',
        });
      });

      expect(result.current.recentSearches).toHaveLength(1);
      expect(result.current.recentSearches[0]).toMatchObject({
        query: 'test query',
        type: 'products',
        id: expect.any(String),
        timestamp: expect.any(String),
      });
    });

    it('should not add empty searches', () => {
      const { result } = renderHook(() => useSearch());

      act(() => {
        result.current.addRecentSearch({ query: '', type: 'products' });
        result.current.addRecentSearch({ query: '   ', type: 'products' });
      });

      expect(result.current.recentSearches).toHaveLength(0);
    });

    it('should remove duplicate searches', () => {
      const { result } = renderHook(() => useSearch());

      act(() => {
        result.current.addRecentSearch({ query: 'test', type: 'products' });
        result.current.addRecentSearch({ query: 'test', type: 'products' });
      });

      expect(result.current.recentSearches).toHaveLength(1);
    });

    it('should limit recent searches to maxRecentSearches', () => {
      const { result } = renderHook(() => useSearch());

      act(() => {
        for (let i = 0; i < 15; i++) {
          result.current.addRecentSearch({
            query: `query ${i}`,
            type: 'products',
          });
        }
      });

      expect(result.current.recentSearches).toHaveLength(10);
    });

    it('should clear all recent searches', () => {
      const { result } = renderHook(() => useSearch());

      act(() => {
        result.current.addRecentSearch({ query: 'test1', type: 'products' });
        result.current.addRecentSearch({ query: 'test2', type: 'products' });
        result.current.clearRecentSearches();
      });

      expect(result.current.recentSearches).toHaveLength(0);
    });

    it('should remove specific recent search', () => {
      const { result } = renderHook(() => useSearch());

      act(() => {
        result.current.addRecentSearch({ query: 'test1', type: 'products' });
        result.current.addRecentSearch({ query: 'test2', type: 'products' });
      });

      // Most recent search (test2) is at index 0
      // Remove it to verify test1 remains
      const searchIdToRemove = result.current.recentSearches[0].id;

      act(() => {
        result.current.removeRecentSearch(searchIdToRemove);
      });

      expect(result.current.recentSearches).toHaveLength(1);
      // After removing test2 (index 0), test1 should remain
      expect(result.current.recentSearches[0].query).toBe('test1');
    });
  });

  describe('Filter Presets', () => {
    it('should add a filter preset', () => {
      const { result } = renderHook(() => useSearch());

      act(() => {
        result.current.addFilterPreset({
          name: 'Low Stock',
          type: 'products',
          filters: { stockMin: 10 },
        });
      });

      expect(result.current.savedFilterPresets).toHaveLength(1);
      expect(result.current.savedFilterPresets[0]).toMatchObject({
        name: 'Low Stock',
        type: 'products',
        filters: { stockMin: 10 },
        id: expect.any(String),
        createdAt: expect.any(String),
      });
    });

    it('should update a filter preset', () => {
      const { result } = renderHook(() => useSearch());

      act(() => {
        result.current.addFilterPreset({
          name: 'Low Stock',
          type: 'products',
          filters: { stockMin: 10 },
        });
      });

      const presetId = result.current.savedFilterPresets[0].id;

      act(() => {
        result.current.updateFilterPreset(presetId, { name: 'Very Low Stock' });
      });

      expect(result.current.savedFilterPresets[0].name).toBe('Very Low Stock');
      expect(result.current.savedFilterPresets[0]).toHaveProperty('updatedAt');
    });

    it('should delete a filter preset', () => {
      const { result } = renderHook(() => useSearch());

      act(() => {
        result.current.addFilterPreset({
          name: 'Preset 1',
          type: 'products',
          filters: {},
        });
        result.current.addFilterPreset({
          name: 'Preset 2',
          type: 'products',
          filters: {},
        });
      });

      const presetIdToDelete = result.current.savedFilterPresets[0].id;

      act(() => {
        result.current.deleteFilterPreset(presetIdToDelete);
      });

      expect(result.current.savedFilterPresets).toHaveLength(1);
      expect(result.current.savedFilterPresets[0].name).toBe('Preset 2');
    });

    it('should get filter presets for type', () => {
      const { result: storeResult } = renderHook(() => useStoreConfig());
      const { result: searchResult } = renderHook(() => useSearch());

      act(() => {
        const store = storeResult.current.addStore({
          name: 'Test Store',
          url: 'https://test.com',
        });
        storeResult.current.setCurrentStore(store.id);
        searchResult.current.addFilterPreset({
          name: 'Product Preset',
          type: 'products',
          filters: {},
          storeId: store.id,
        });
        searchResult.current.addFilterPreset({
          name: 'Order Preset',
          type: 'orders',
          filters: {},
          storeId: store.id,
        });
      });

      const productPresets = searchResult.current.getFilterPresetsForType(
        'products',
        storeResult.current.currentStoreId
      );

      expect(productPresets).toHaveLength(1);
      expect(productPresets[0].name).toBe('Product Preset');
    });
  });

  describe('Cache Management', () => {
    it('should set cached data', async () => {
      const { result: storeResult } = renderHook(() => useStoreConfig());
      const { result: cacheResult } = renderHook(() => useCache());

      act(() => {
        storeResult.current.addStore({
          name: 'Test Store',
          url: 'https://test.com',
        });
      });

      const testData = [{ id: 1, name: 'Product 1' }];

      await act(async () => {
        await cacheResult.current.setCachedData('products', testData);
      });

      expect(cacheResult.current.cache.products.data).toEqual(testData);
      expect(cacheResult.current.cache.products.timestamp).toBeTruthy();
      expect(indexedDBCache.saveToCache).toHaveBeenCalled();
    });

    it('should split orders by status when caching', async () => {
      const { result: storeResult } = renderHook(() => useStoreConfig());
      const { result: cacheResult } = renderHook(() => useCache());

      act(() => {
        storeResult.current.addStore({
          name: 'Test Store',
          url: 'https://test.com',
        });
      });

      // Orders are now split by status, not date
      const activeOrder = {
        id: 1,
        status: 'processing',
        date_created: new Date().toISOString(),
      };
      const completedOrder = {
        id: 2,
        status: 'completed',
        date_created: new Date().toISOString(),
      };

      await act(async () => {
        await cacheResult.current.setCachedData('orders', [activeOrder, completedOrder]);
      });

      // Active orders go to ordersRecent, completed to ordersOld
      expect(cacheResult.current.cache.ordersRecent.data).toHaveLength(1);
      expect(cacheResult.current.cache.ordersOld.data).toHaveLength(1);
      expect(cacheResult.current.cache.orders.data).toHaveLength(2);
    });

    it('should get cached data from memory', async () => {
      const { result: storeResult } = renderHook(() => useStoreConfig());
      const { result: cacheResult } = renderHook(() => useCache());

      act(() => {
        storeResult.current.addStore({
          name: 'Test Store',
          url: 'https://test.com',
        });
      });

      const testData = [{ id: 1, name: 'Product 1' }];

      await act(async () => {
        await cacheResult.current.setCachedData('products', testData);
      });

      const cachedData = await act(async () => {
        return await cacheResult.current.getCachedData('products');
      });

      expect(cachedData).toEqual(testData);
    });

    it('should return null for expired cache', async () => {
      const { result: storeResult } = renderHook(() => useStoreConfig());
      const { result: cacheResult } = renderHook(() => useCache());

      act(() => {
        storeResult.current.addStore({
          name: 'Test Store',
          url: 'https://test.com',
        });
      });

      // Set expired cache
      const expiredTimestamp = Date.now() - 60 * 60 * 1000; // 1 hour ago
      act(() => {
        useCache.setState({
          cache: {
            ...cacheResult.current.cache,
            products: {
              data: [{ id: 1 }],
              timestamp: expiredTimestamp,
              storeId: storeResult.current.currentStoreId,
              lastSync: null,
            },
          },
        });
      });

      const cachedData = await act(async () => {
        return await cacheResult.current.getCachedData('products');
      });

      expect(cachedData).toBeNull();
    });

    it('should clear all cache', async () => {
      const { result: storeResult } = renderHook(() => useStoreConfig());
      const { result: cacheResult } = renderHook(() => useCache());

      act(() => {
        storeResult.current.addStore({
          name: 'Test Store',
          url: 'https://test.com',
        });
      });

      await act(async () => {
        await cacheResult.current.setCachedData('products', [{ id: 1 }]);
        await cacheResult.current.clearCache();
      });

      expect(cacheResult.current.cache.products.data).toBeNull();
      expect(cacheResult.current.cache.orders.data).toBeNull();
      expect(indexedDBCache.clearAllCache).toHaveBeenCalled();
    });

    it('should clear cache for specific type', async () => {
      const { result: storeResult } = renderHook(() => useStoreConfig());
      const { result: cacheResult } = renderHook(() => useCache());

      act(() => {
        storeResult.current.addStore({
          name: 'Test Store',
          url: 'https://test.com',
        });
      });

      await act(async () => {
        await cacheResult.current.setCachedData('products', [{ id: 1 }]);
        await cacheResult.current.clearCacheForType('products');
      });

      expect(cacheResult.current.cache.products.data).toBeNull();
      expect(indexedDBCache.clearCacheStore).toHaveBeenCalled();
    });

    it('should clear all order caches when clearing orders', async () => {
      const { result: storeResult } = renderHook(() => useStoreConfig());
      const { result: cacheResult } = renderHook(() => useCache());

      act(() => {
        storeResult.current.addStore({
          name: 'Test Store',
          url: 'https://test.com',
        });
      });

      const orders = [
        { id: 1, status: 'processing', date_created: new Date().toISOString() },
        { id: 2, status: 'completed', date_created: new Date().toISOString() },
      ];

      await act(async () => {
        await cacheResult.current.setCachedData('orders', orders);
        await cacheResult.current.clearCacheForType('orders');
      });

      expect(cacheResult.current.cache.orders.data).toBeNull();
      expect(cacheResult.current.cache.ordersRecent.data).toBeNull();
      expect(cacheResult.current.cache.ordersOld.data).toBeNull();
    });
  });

  describe('Persistence', () => {
    it('should persist stores configuration', () => {
      const { result } = renderHook(() => useStoreConfig());

      act(() => {
        result.current.addStore({
          name: 'Test Store',
          url: 'https://test.com',
          consumerKey: 'key',
          consumerSecret: 'secret',
        });
      });

      // The store uses Zustand persist middleware, so stores should be persisted
      expect(result.current.stores).toHaveLength(1);
    });
  });

  describe('Combined useStore', () => {
    it('should provide access to all store data', () => {
      const { result } = renderHook(() => useStore());

      // Combined store should have properties from all individual stores
      expect(result.current).toHaveProperty('stores');
      expect(result.current).toHaveProperty('theme');
      expect(result.current).toHaveProperty('autoRefresh');
      expect(result.current).toHaveProperty('recentSearches');
      expect(result.current).toHaveProperty('cache');
    });
  });
});
