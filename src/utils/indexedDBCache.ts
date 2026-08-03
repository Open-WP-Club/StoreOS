/**
 * IndexedDB Cache Utility
 * Provides persistent storage for WooCommerce data with much larger capacity than localStorage
 */

// ============================================
// Types
// ============================================

interface CacheData<T = unknown> {
  data: T;
  timestamp: number;
  storeId: string;
}

interface IndexedDBStatus {
  available: boolean;
  supported: boolean;
}

type StoreName = 'products' | 'orders' | 'customers' | 'coupons' | 'offline_queue';

// ============================================
// Constants
// ============================================

const DB_NAME = 'woocommerce-cache';
const DB_VERSION = 3; // Incremented to add customers, coupons, and offline_queue stores

export const STORES = {
  PRODUCTS: 'products' as const,
  ORDERS: 'orders' as const,
  CUSTOMERS: 'customers' as const,
  COUPONS: 'coupons' as const,
  OFFLINE_QUEUE: 'offline_queue' as const,
};

// ============================================
// State
// ============================================

let dbInstance: IDBDatabase | null = null;
let isIndexedDBAvailable = true;
let initAttempts = 0;
const MAX_INIT_ATTEMPTS = 2;

// ============================================
// Internal Functions
// ============================================

/**
 * Check if IndexedDB is available and working
 */
const checkIndexedDBAvailability = (): boolean => {
  if (typeof indexedDB === 'undefined') {
    isIndexedDBAvailable = false;
    return false;
  }
  return isIndexedDBAvailable;
};

/**
 * Recover from corrupted database by deleting and recreating it
 */
const recoverFromCorruption = async (): Promise<boolean> => {
  try {
    // Close existing connection if any
    if (dbInstance) {
      dbInstance.close();
      dbInstance = null;
    }

    // Delete the corrupted database
    await new Promise<void>((resolve, reject) => {
      const deleteRequest = indexedDB.deleteDatabase(DB_NAME);
      deleteRequest.onsuccess = () => resolve();
      deleteRequest.onerror = () => reject(deleteRequest.error);
      deleteRequest.onblocked = () => reject(new Error('Database deletion blocked'));
    });

    // Wait a bit before recreating
    await new Promise<void>(resolve => setTimeout(resolve, 100));

    return true;
  } catch {
    isIndexedDBAvailable = false;
    return false;
  }
};

/**
 * Initialize IndexedDB with error recovery
 */
const initDB = async (): Promise<IDBDatabase> => {
  if (!checkIndexedDBAvailability()) {
    throw new Error('IndexedDB is not available');
  }

  if (dbInstance) {
    return dbInstance;
  }

  initAttempts++;

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = async () => {
      const error = request.error;

      // Check if this is a backing store error (corruption)
      const isCorrupted =
        error?.name === 'UnknownError' ||
        error?.message?.includes('backing store') ||
        error?.message?.includes('Internal error');

      // Only attempt recovery once
      if (isCorrupted && initAttempts < MAX_INIT_ATTEMPTS) {
        const recovered = await recoverFromCorruption();

        if (recovered) {
          // Reset attempts and try again
          initAttempts = 0;
          try {
            const db = await initDB();
            resolve(db);
            return;
          } catch {
            // Recovery attempt failed
          }
        }
      }

      // If recovery failed or not applicable, mark IndexedDB as unavailable
      isIndexedDBAvailable = false;
      reject(error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      initAttempts = 0; // Reset attempts on success

      // Handle unexpected close
      dbInstance.onversionchange = () => {
        dbInstance?.close();
        dbInstance = null;
      };

      dbInstance.onerror = () => {
        // Database error occurred
      };

      resolve(dbInstance);
    };

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object stores if they don't exist
      if (!db.objectStoreNames.contains(STORES.PRODUCTS)) {
        db.createObjectStore(STORES.PRODUCTS);
      }
      if (!db.objectStoreNames.contains(STORES.ORDERS)) {
        db.createObjectStore(STORES.ORDERS);
      }
      if (!db.objectStoreNames.contains(STORES.CUSTOMERS)) {
        db.createObjectStore(STORES.CUSTOMERS);
      }
      if (!db.objectStoreNames.contains(STORES.COUPONS)) {
        db.createObjectStore(STORES.COUPONS);
      }
      if (!db.objectStoreNames.contains(STORES.OFFLINE_QUEUE)) {
        db.createObjectStore(STORES.OFFLINE_QUEUE);
      }

      // Remove deprecated inventory store if it exists (migration)
      if (db.objectStoreNames.contains('inventory')) {
        db.deleteObjectStore('inventory');
      }
    };

    request.onblocked = () => {
      // Database opening blocked
    };
  });
};

// ============================================
// Exported Functions
// ============================================

/**
 * Save data to IndexedDB
 */
export const saveToCache = async <T>(
  storeName: StoreName,
  key: string,
  data: T
): Promise<boolean> => {
  if (!checkIndexedDBAvailability()) {
    return false;
  }

  try {
    const db = await initDB();
    // Use relaxed durability for faster writes (Chromium 121+)
    // This trades off some durability guarantees for 20-30% faster writes
    const transaction = db.transaction([storeName], 'readwrite', { durability: 'relaxed' });
    const objectStore = transaction.objectStore(storeName);

    const cacheData: CacheData<T> = {
      data,
      timestamp: Date.now(),
      storeId: key,
    };

    return new Promise<boolean>((resolve, reject) => {
      const request = objectStore.put(cacheData, key);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return false;
  }
};

/**
 * Get data from IndexedDB
 * @param maxAge - Maximum age of cache in milliseconds (default: 5 minutes)
 */
export const getFromCache = async <T>(
  storeName: StoreName,
  key: string,
  maxAge: number = 5 * 60 * 1000
): Promise<T | null> => {
  if (!checkIndexedDBAvailability()) {
    return null;
  }

  try {
    const db = await initDB();
    const transaction = db.transaction([storeName], 'readonly');
    const objectStore = transaction.objectStore(storeName);

    return new Promise<T | null>((resolve, reject) => {
      const request = objectStore.get(key);

      request.onsuccess = () => {
        const result = request.result as CacheData<T> | undefined;

        if (!result) {
          resolve(null);
          return;
        }

        // Check if cache is expired
        const age = Date.now() - result.timestamp;
        if (age > maxAge) {
          resolve(null);
          return;
        }

        resolve(result.data);
      };

      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
};

/**
 * Clear specific cache store
 */
export const clearCacheStore = async (storeName: StoreName): Promise<boolean> => {
  if (!checkIndexedDBAvailability()) {
    return false;
  }

  try {
    const db = await initDB();
    // Use relaxed durability for faster cache clearing
    const transaction = db.transaction([storeName], 'readwrite', { durability: 'relaxed' });
    const objectStore = transaction.objectStore(storeName);

    return new Promise<boolean>((resolve, reject) => {
      const request = objectStore.clear();
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return false;
  }
};

/**
 * Clear all cache stores
 */
export const clearAllCache = async (): Promise<boolean> => {
  if (!checkIndexedDBAvailability()) {
    return false;
  }

  try {
    await Promise.all([
      clearCacheStore(STORES.PRODUCTS),
      clearCacheStore(STORES.ORDERS),
      clearCacheStore(STORES.CUSTOMERS),
      clearCacheStore(STORES.COUPONS),
    ]);
    return true;
  } catch {
    return false;
  }
};

/**
 * Delete the entire IndexedDB database
 */
export const deleteDatabase = async (): Promise<boolean> => {
  if (!checkIndexedDBAvailability()) {
    return false;
  }

  return new Promise<boolean>((resolve, reject) => {
    if (dbInstance) {
      dbInstance.close();
      dbInstance = null;
    }

    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      // Database deletion blocked
    };
  });
};

/**
 * Get IndexedDB availability status
 */
export const getIndexedDBStatus = (): IndexedDBStatus => {
  return {
    available: isIndexedDBAvailable,
    supported: typeof indexedDB !== 'undefined',
  };
};
