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
// v4: orders/products/customers/coupons are stored one record per item in `<name>_items`
// (keyPath `id`); the legacy out-of-line stores keep scalars (lastSync, offline queue) and
// per-collection metadata. Old whole-array blobs are migrated on upgrade.
const DB_VERSION = 4;

export const STORES = {
  PRODUCTS: 'products' as const,
  ORDERS: 'orders' as const,
  CUSTOMERS: 'customers' as const,
  COUPONS: 'coupons' as const,
  OFFLINE_QUEUE: 'offline_queue' as const,
};

type CollectionStore = 'products' | 'orders' | 'customers' | 'coupons';
const COLLECTION_STORES: CollectionStore[] = ['products', 'orders', 'customers', 'coupons'];
const itemsStoreOf = (s: string): string => `${s}_items`;
const metaKey = (scope: string): string => `meta:${scope}`;
const itemKey = (scope: string, id: string | number): string => `${scope}:${id}`;
const scopeRange = (scope: string): IDBKeyRange =>
  IDBKeyRange.bound(`${scope}:`, `${scope}:\uffff`);
const ITEM_CHUNK = 500;

interface ItemRecord<T = unknown> {
  id: string; // `${scope}:${itemId}`
  ts: number;
  o: number; // position in the saved array (best-effort ordering)
  d: T;
}

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
 * v3 -> v4: split whole-array blobs into per-item records (runs inside the upgrade tx).
 * Orders/products keep only `<store>_recent|_old` blobs (the full-array copy was redundant).
 */
const migrateBlobsToItems = (tx: IDBTransaction): void => {
  for (const name of COLLECTION_STORES) {
    if (!tx.objectStoreNames.contains(name)) continue;
    const legacy = tx.objectStore(name);
    const dest = tx.objectStore(itemsStoreOf(name));
    const scoped = name === 'customers' || name === 'coupons';
    legacy.openCursor().onsuccess = (e) => {
      const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (!cursor) return;
      const rec = cursor.value as CacheData<unknown> | undefined;
      if (rec && Array.isArray(rec.data)) {
        const key = String(cursor.key);
        if (scoped || /_(recent|old)$/.test(key)) {
          rec.data.forEach((item: { id?: string | number } | null, i: number) => {
            if (item && item.id != null) {
              dest.put({ id: itemKey(key, item.id), ts: rec.timestamp, o: i, d: item });
            }
          });
          legacy.put({ data: null, timestamp: rec.timestamp, storeId: key }, metaKey(key));
        }
        cursor.delete();
      }
      cursor.continue();
    };
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
      const openReq = event.target as IDBOpenDBRequest;
      const db = openReq.result;

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

      for (const name of COLLECTION_STORES) {
        if (!db.objectStoreNames.contains(itemsStoreOf(name))) {
          db.createObjectStore(itemsStoreOf(name), { keyPath: 'id' });
        }
      }
      if (event.oldVersion > 0 && event.oldVersion < 4 && openReq.transaction) {
        migrateBlobsToItems(openReq.transaction);
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

// ============================================
// Per-item collections (orders / products / customers / coupons)
// ============================================

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

const runTx = (
  db: IDBDatabase,
  names: string[],
  fn: (tx: IDBTransaction) => void
): Promise<void> =>
  new Promise((resolve, reject) => {
    const tx = db.transaction(names, 'readwrite', { durability: 'relaxed' });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
    fn(tx);
  });

const idbReq = <R>(req: IDBRequest<R>): Promise<R> =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

// Serialize collection writes so overlapping saves/deltas apply in call order.
let writeQueue: Promise<unknown> = Promise.resolve();
const enqueue = <R>(fn: () => Promise<R>): Promise<R> => {
  const run = writeQueue.then(fn, fn);
  writeQueue = run.catch(() => undefined);
  return run;
};

const putMeta = (db: IDBDatabase, store: CollectionStore, scope: string): Promise<void> =>
  runTx(db, [store], (tx) => {
    tx.objectStore(store).put({ data: null, timestamp: Date.now(), storeId: scope }, metaKey(scope));
  });

/**
 * Replace a whole collection. Writes in chunked transactions (yielding between chunks),
 * then removes records no longer present, then stamps the metadata.
 */
export const saveCollection = <T extends { id: string | number }>(
  store: CollectionStore,
  scope: string,
  items: readonly T[]
): Promise<boolean> => {
  if (!checkIndexedDBAvailability()) return Promise.resolve(false);
  return enqueue(async () => {
    try {
      const db = await initDB();
      const dest = itemsStoreOf(store);
      const ts = Date.now();
      const keep = new Set<string>();
      for (let i = 0; i < items.length; i += ITEM_CHUNK) {
        const slice = items.slice(i, i + ITEM_CHUNK);
        await runTx(db, [dest], (tx) => {
          const os = tx.objectStore(dest);
          slice.forEach((item, j) => {
            const id = itemKey(scope, item.id);
            keep.add(id);
            os.put({ id, ts, o: i + j, d: item } satisfies ItemRecord<T>);
          });
        });
        await tick();
      }
      const keys = (await idbReq(
        db.transaction([dest], 'readonly').objectStore(dest).getAllKeys(scopeRange(scope))
      )) as string[];
      const stale = keys.filter((k) => !keep.has(k));
      for (let i = 0; i < stale.length; i += ITEM_CHUNK) {
        const slice = stale.slice(i, i + ITEM_CHUNK);
        await runTx(db, [dest], (tx) => slice.forEach((k) => tx.objectStore(dest).delete(k)));
        await tick();
      }
      await putMeta(db, store, scope);
      return true;
    } catch {
      return false;
    }
  });
};

/**
 * Apply a small change set (single-item updates / delta sync) without rewriting the collection.
 * `index` is the item's position in the new array (used for best-effort ordering on load).
 */
export const applyCollectionDelta = <T extends { id: string | number }>(
  store: CollectionStore,
  scope: string,
  puts: readonly { item: T; index: number }[],
  deleteIds: readonly (string | number)[]
): Promise<boolean> => {
  if (!checkIndexedDBAvailability()) return Promise.resolve(false);
  return enqueue(async () => {
    try {
      const db = await initDB();
      const dest = itemsStoreOf(store);
      const ts = Date.now();
      for (let i = 0; i < puts.length; i += ITEM_CHUNK) {
        const slice = puts.slice(i, i + ITEM_CHUNK);
        await runTx(db, [dest], (tx) => {
          const os = tx.objectStore(dest);
          for (const { item, index } of slice) {
            os.put({ id: itemKey(scope, item.id), ts, o: index, d: item } satisfies ItemRecord<T>);
          }
        });
        await tick();
      }
      for (let i = 0; i < deleteIds.length; i += ITEM_CHUNK) {
        const slice = deleteIds.slice(i, i + ITEM_CHUNK);
        await runTx(db, [dest], (tx) =>
          slice.forEach((id) => tx.objectStore(dest).delete(itemKey(scope, id)))
        );
        await tick();
      }
      await putMeta(db, store, scope);
      return true;
    } catch {
      return false;
    }
  });
};

/**
 * Load a collection (null when missing or older than maxAge). Reads in chunks, yielding
 * to the event loop between chunks.
 */
export const getCollection = async <T>(
  store: CollectionStore,
  scope: string,
  maxAge: number
): Promise<T[] | null> => {
  if (!checkIndexedDBAvailability()) return null;
  try {
    const db = await initDB();
    const meta = (await idbReq(
      db.transaction([store], 'readonly').objectStore(store).get(metaKey(scope))
    )) as CacheData<null> | undefined;
    if (!meta || Date.now() - meta.timestamp > maxAge) return null;

    const dest = itemsStoreOf(store);
    const { lower, upper } = { lower: `${scope}:`, upper: `${scope}:\uffff` };
    const all: ItemRecord<T>[] = [];
    let range = IDBKeyRange.bound(lower, upper);
    for (;;) {
      const chunk = (await idbReq(
        db.transaction([dest], 'readonly').objectStore(dest).getAll(range, ITEM_CHUNK)
      )) as ItemRecord<T>[];
      for (const r of chunk) all.push(r);
      if (chunk.length < ITEM_CHUNK) break;
      range = IDBKeyRange.bound(chunk[chunk.length - 1]!.id, upper, true, false);
      await tick();
    }
    all.sort((a, b) => a.o - b.o);
    return all.map((r) => r.d);
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
    const isCollection = (COLLECTION_STORES as string[]).includes(storeName);
    const transaction = db.transaction(
      isCollection ? [storeName, itemsStoreOf(storeName)] : [storeName],
      'readwrite',
      { durability: 'relaxed' }
    );
    const objectStore = transaction.objectStore(storeName);
    if (isCollection) transaction.objectStore(itemsStoreOf(storeName)).clear();

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
