import { vi } from 'vitest';

// Helper to create a fresh IndexedDB mock environment
function createIndexedDBMock() {
  const mockObjectStore = {
    put: vi.fn(),
    get: vi.fn(),
    clear: vi.fn(),
  };

  const mockTransaction = {
    objectStore: vi.fn().mockReturnValue(mockObjectStore),
  };

  const mockDB = {
    transaction: vi.fn().mockReturnValue(mockTransaction),
    close: vi.fn(),
    onversionchange: null,
    onerror: null,
    objectStoreNames: {
      contains: vi.fn().mockReturnValue(false),
    },
  };

  return { mockObjectStore, mockTransaction, mockDB };
}

// Helper to set up global.indexedDB with auto-triggering open requests.
// Each call to indexedDB.open() gets its own request object so concurrent
// initDB calls don't overwrite each other's onsuccess handlers.
function setupGlobalIndexedDB(mockDB) {
  global.indexedDB = {
    open: vi.fn().mockImplementation(() => {
      const req = {
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
        onblocked: null,
        result: mockDB,
        error: null,
      };
      Promise.resolve().then(() => {
        if (req.onsuccess) req.onsuccess();
      });
      return req;
    }),
    deleteDatabase: vi.fn().mockReturnValue({
      onsuccess: null,
      onerror: null,
      onblocked: null,
    }),
  };
}

// Helper to get a fresh module import (resets dbInstance)
async function getFreshModule() {
  vi.resetModules();
  return import('../indexedDBCache');
}

describe('indexedDBCache', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('STORES export', () => {
    it('should export store names', async () => {
      const { STORES } = await getFreshModule();
      expect(STORES.PRODUCTS).toBe('products');
      expect(STORES.ORDERS).toBe('orders');
    });
  });

  describe('getIndexedDBStatus', () => {
    it('should return IndexedDB status', async () => {
      const { mockDB } = createIndexedDBMock();
      setupGlobalIndexedDB(mockDB);

      const { getIndexedDBStatus } = await getFreshModule();
      const status = getIndexedDBStatus();
      expect(status).toHaveProperty('available');
      expect(status).toHaveProperty('supported');
      expect(status.supported).toBe(true);
    });

    it('should detect when IndexedDB is not supported', async () => {
      const originalIndexedDB = global.indexedDB;
      delete global.indexedDB;

      const { getIndexedDBStatus } = await getFreshModule();
      const status = getIndexedDBStatus();
      expect(status.supported).toBe(false);

      global.indexedDB = originalIndexedDB;
    });
  });

  describe('saveToCache', () => {
    it('should save data to cache successfully', async () => {
      const { mockObjectStore, mockDB } = createIndexedDBMock();
      setupGlobalIndexedDB(mockDB);

      mockObjectStore.put.mockImplementation(() => {
        const req = { onsuccess: null, onerror: null };
        Promise.resolve().then(() => {
          if (req.onsuccess) req.onsuccess();
        });
        return req;
      });

      const { saveToCache, STORES } = await getFreshModule();
      const result = await saveToCache(STORES.PRODUCTS, 'store-1', { products: [] });

      expect(result).toBe(true);
      expect(mockDB.transaction).toHaveBeenCalledWith([STORES.PRODUCTS], 'readwrite', {
        durability: 'relaxed',
      });
      expect(mockObjectStore.put).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { products: [] },
          storeId: 'store-1',
          timestamp: expect.any(Number),
        }),
        'store-1'
      );
    });

    it('should propagate save errors as rejection', async () => {
      const { mockObjectStore, mockDB } = createIndexedDBMock();
      setupGlobalIndexedDB(mockDB);

      mockObjectStore.put.mockImplementation(() => {
        const req = { onsuccess: null, onerror: null, error: new Error('Put failed') };
        Promise.resolve().then(() => {
          if (req.onerror) req.onerror();
        });
        return req;
      });

      const { saveToCache, STORES } = await getFreshModule();

      // The inner promise rejects; the return-in-try pattern doesn't catch it
      await expect(saveToCache(STORES.PRODUCTS, 'store-1', { products: [] })).rejects.toThrow(
        'Put failed'
      );
    });

    it('should return false when IndexedDB is unavailable', async () => {
      delete global.indexedDB;

      const { saveToCache, STORES } = await getFreshModule();
      const result = await saveToCache(STORES.PRODUCTS, 'store-1', {});
      expect(result).toBe(false);

      // Restore
      global.indexedDB = { open: vi.fn(), deleteDatabase: vi.fn() };
    });
  });

  describe('getFromCache', () => {
    it('should retrieve valid cached data', async () => {
      const { mockObjectStore, mockDB } = createIndexedDBMock();
      setupGlobalIndexedDB(mockDB);

      const now = Date.now();
      mockObjectStore.get.mockImplementation(() => {
        const req = {
          onsuccess: null,
          onerror: null,
          result: {
            data: { products: [{ id: 1 }] },
            timestamp: now - 1000,
            storeId: 'store-1',
          },
        };
        Promise.resolve().then(() => {
          if (req.onsuccess) req.onsuccess();
        });
        return req;
      });

      const { getFromCache, STORES } = await getFreshModule();
      const result = await getFromCache(STORES.PRODUCTS, 'store-1', 5 * 60 * 1000);

      expect(result).toEqual({ products: [{ id: 1 }] });
      expect(mockDB.transaction).toHaveBeenCalledWith([STORES.PRODUCTS], 'readonly');
      expect(mockObjectStore.get).toHaveBeenCalledWith('store-1');
    });

    it('should return null for expired cache', async () => {
      const { mockObjectStore, mockDB } = createIndexedDBMock();
      setupGlobalIndexedDB(mockDB);

      const now = Date.now();
      mockObjectStore.get.mockImplementation(() => {
        const req = {
          onsuccess: null,
          onerror: null,
          result: {
            data: { products: [] },
            timestamp: now - 10 * 60 * 1000, // 10 minutes ago
            storeId: 'store-1',
          },
        };
        Promise.resolve().then(() => {
          if (req.onsuccess) req.onsuccess();
        });
        return req;
      });

      const { getFromCache, STORES } = await getFreshModule();
      const result = await getFromCache(STORES.PRODUCTS, 'store-1', 5 * 60 * 1000);

      expect(result).toBeNull();
    });

    it('should return null when no cache exists', async () => {
      const { mockObjectStore, mockDB } = createIndexedDBMock();
      setupGlobalIndexedDB(mockDB);

      mockObjectStore.get.mockImplementation(() => {
        const req = { onsuccess: null, onerror: null, result: null };
        Promise.resolve().then(() => {
          if (req.onsuccess) req.onsuccess();
        });
        return req;
      });

      const { getFromCache, STORES } = await getFreshModule();
      const result = await getFromCache(STORES.PRODUCTS, 'store-1');

      expect(result).toBeNull();
    });

    it('should propagate get errors as rejection', async () => {
      const { mockObjectStore, mockDB } = createIndexedDBMock();
      setupGlobalIndexedDB(mockDB);

      mockObjectStore.get.mockImplementation(() => {
        const req = { onsuccess: null, onerror: null, error: new Error('Get failed') };
        Promise.resolve().then(() => {
          if (req.onerror) req.onerror();
        });
        return req;
      });

      const { getFromCache, STORES } = await getFreshModule();

      // The inner promise rejects; the return-in-try pattern doesn't catch it
      await expect(getFromCache(STORES.PRODUCTS, 'store-1')).rejects.toThrow('Get failed');
    });

    it('should return null when IndexedDB is unavailable', async () => {
      delete global.indexedDB;

      const { getFromCache, STORES } = await getFreshModule();
      const result = await getFromCache(STORES.PRODUCTS, 'store-1');
      expect(result).toBeNull();

      global.indexedDB = { open: vi.fn(), deleteDatabase: vi.fn() };
    });
  });

  describe('clearCacheStore', () => {
    it('should clear a cache store successfully', async () => {
      const { mockObjectStore, mockDB } = createIndexedDBMock();
      setupGlobalIndexedDB(mockDB);

      mockObjectStore.clear.mockImplementation(() => {
        const req = { onsuccess: null, onerror: null };
        Promise.resolve().then(() => {
          if (req.onsuccess) req.onsuccess();
        });
        return req;
      });

      const { clearCacheStore, STORES } = await getFreshModule();
      const result = await clearCacheStore(STORES.PRODUCTS);

      expect(result).toBe(true);
      expect(mockDB.transaction).toHaveBeenCalledWith([STORES.PRODUCTS, 'products_items'], 'readwrite', {
        durability: 'relaxed',
      });
      expect(mockObjectStore.clear).toHaveBeenCalled();
    });

    it('should propagate clear errors as rejection', async () => {
      const { mockObjectStore, mockDB } = createIndexedDBMock();
      setupGlobalIndexedDB(mockDB);

      mockObjectStore.clear.mockImplementation(() => {
        const req = { onsuccess: null, onerror: null, error: new Error('Clear failed') };
        Promise.resolve().then(() => {
          if (req.onerror) req.onerror();
        });
        return req;
      });

      const { clearCacheStore, STORES } = await getFreshModule();

      // The inner promise rejects; the return-in-try pattern doesn't catch it
      await expect(clearCacheStore(STORES.PRODUCTS)).rejects.toThrow('Clear failed');
    });

    it('should return false when IndexedDB is unavailable', async () => {
      delete global.indexedDB;

      const { clearCacheStore, STORES } = await getFreshModule();
      const result = await clearCacheStore(STORES.PRODUCTS);
      expect(result).toBe(false);

      global.indexedDB = { open: vi.fn(), deleteDatabase: vi.fn() };
    });
  });

  describe('clearAllCache', () => {
    it('should clear all cache stores', async () => {
      const { mockObjectStore, mockDB } = createIndexedDBMock();
      setupGlobalIndexedDB(mockDB);

      mockObjectStore.clear.mockImplementation(() => {
        const req = { onsuccess: null, onerror: null };
        Promise.resolve().then(() => {
          if (req.onsuccess) req.onsuccess();
        });
        return req;
      });

      const { clearAllCache } = await getFreshModule();
      const result = await clearAllCache();

      expect(result).toBe(true);
    });

    it('should return false when IndexedDB is unavailable', async () => {
      delete global.indexedDB;

      const { clearAllCache } = await getFreshModule();
      const result = await clearAllCache();
      expect(result).toBe(false);

      global.indexedDB = { open: vi.fn(), deleteDatabase: vi.fn() };
    });
  });

  describe('deleteDatabase', () => {
    it('should delete the database successfully', async () => {
      const { mockDB } = createIndexedDBMock();

      global.indexedDB = {
        open: vi.fn().mockImplementation(() => {
          const req = {
            onsuccess: null,
            onerror: null,
            onupgradeneeded: null,
            onblocked: null,
            result: mockDB,
            error: null,
          };
          Promise.resolve().then(() => {
            if (req.onsuccess) req.onsuccess();
          });
          return req;
        }),
        deleteDatabase: vi.fn().mockImplementation(() => {
          const deleteRequest = { onsuccess: null, onerror: null, onblocked: null };
          Promise.resolve().then(() => {
            if (deleteRequest.onsuccess) deleteRequest.onsuccess();
          });
          return deleteRequest;
        }),
      };

      const { deleteDatabase } = await getFreshModule();
      const result = await deleteDatabase();

      expect(result).toBe(true);
      expect(global.indexedDB.deleteDatabase).toHaveBeenCalledWith('woocommerce-cache');
    });

    it('should handle delete errors', async () => {
      const { mockDB } = createIndexedDBMock();

      global.indexedDB = {
        open: vi.fn().mockImplementation(() => {
          const req = {
            onsuccess: null,
            onerror: null,
            result: mockDB,
            error: null,
          };
          return req;
        }),
        deleteDatabase: vi.fn().mockImplementation(() => {
          const deleteRequest = {
            onsuccess: null,
            onerror: null,
            onblocked: null,
            error: new Error('Delete failed'),
          };
          Promise.resolve().then(() => {
            if (deleteRequest.onerror) deleteRequest.onerror();
          });
          return deleteRequest;
        }),
      };

      const { deleteDatabase } = await getFreshModule();
      await expect(deleteDatabase()).rejects.toThrow();
    });

    it('should return false when IndexedDB is unavailable', async () => {
      delete global.indexedDB;

      const { deleteDatabase } = await getFreshModule();
      const result = await deleteDatabase();
      expect(result).toBe(false);

      global.indexedDB = { open: vi.fn(), deleteDatabase: vi.fn() };
    });
  });
});
