import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Integration tests against a real (fake-indexeddb) database; the sibling indexedDBCache.test.js
// covers the same module with hand-rolled mocks.

type Mod = typeof import('../indexedDBCache');
const load = async (): Promise<Mod> => {
  vi.resetModules(); // drops the module-level dbInstance so each test re-opens the database
  return import('../indexedDBCache');
};
const mk = (n: number, tag = 'a') => Array.from({ length: n }, (_, i) => ({ id: i + 1, tag }));
const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

describe('indexedDBCache (fake-indexeddb)', () => {
  it('round-trips a collection in saved order', async () => {
    const m = await load();
    const items = [3, 1, 2].map((id) => ({ id, v: id }));
    expect(await m.saveCollection('orders', 's1', items)).toBe(true);
    expect(await m.getCollection('orders', 's1', DAY)).toEqual(items);
  });

  it('applies concurrent saveCollection + applyCollectionDelta in call order', async () => {
    const m = await load();
    const base = mk(10, 'base');
    const delta = [{ item: { id: 5, tag: 'delta' }, index: 4 }];
    // Fire without awaiting between: the write queue must serialize them.
    const results = await Promise.all([
      m.saveCollection('orders', 's1', base),
      m.applyCollectionDelta('orders', 's1', delta, [1]),
    ]);
    expect(results).toEqual([true, true]);
    const got = (await m.getCollection<{ id: number; tag: string }>('orders', 's1', DAY))!;
    expect(got.find((x) => x.id === 5)?.tag).toBe('delta');
    expect(got.some((x) => x.id === 1)).toBe(false);
    expect(got).toHaveLength(9);
  });

  it('a later save wins over an earlier overlapping delta', async () => {
    const m = await load();
    await m.saveCollection('orders', 's1', mk(5, 'base'));
    const p = Promise.all([
      m.applyCollectionDelta('orders', 's1', [{ item: { id: 2, tag: 'delta' }, index: 1 }], []),
      m.saveCollection('orders', 's1', mk(3, 'final')),
    ]);
    await p;
    const got = (await m.getCollection<{ id: number; tag: string }>('orders', 's1', DAY))!;
    expect(got.map((x) => x.tag)).toEqual(['final', 'final', 'final']);
  });

  it('isolates scopes within a store and across stores', async () => {
    const m = await load();
    await m.saveCollection('orders', 's1_recent', mk(3, 'recent'));
    await m.saveCollection('orders', 's1_old', mk(2, 'old'));
    await m.saveCollection('products', 's1_recent', mk(4, 'prod'));
    // replacing one scope must not touch another (note: `s1` is a prefix of `s1_old`)
    await m.saveCollection('orders', 's1', mk(1, 'plain'));
    await m.saveCollection('orders', 's1', []);

    expect(await m.getCollection('orders', 's1_recent', DAY)).toHaveLength(3);
    expect(await m.getCollection('orders', 's1_old', DAY)).toHaveLength(2);
    expect(await m.getCollection('products', 's1_recent', DAY)).toHaveLength(4);
    expect(await m.getCollection('orders', 's2', DAY)).toBeNull();

    await m.applyCollectionDelta('orders', 's1_old', [], [1, 2]);
    expect(await m.getCollection('orders', 's1_old', DAY)).toEqual([]);
    expect(await m.getCollection('orders', 's1_recent', DAY)).toHaveLength(3);
  });

  it('returns null for a collection older than maxAge', async () => {
    const m = await load();
    await m.saveCollection('coupons', 's1', mk(2));
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 2 * DAY);
    try {
      expect(await m.getCollection('coupons', 's1', DAY)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('migrates v3 whole-array blobs to per-item records, idempotently', async () => {
    // Build a v3 database by hand.
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('woocommerce-cache', 3);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const s of ['products', 'orders', 'customers', 'coupons', 'offline_queue']) {
          db.createObjectStore(s);
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(['orders', 'customers', 'offline_queue'], 'readwrite');
        const ts = Date.now();
        tx.objectStore('orders').put(
          { data: mk(3, 'v3'), timestamp: ts, storeId: 's1_recent' },
          's1_recent'
        );
        // redundant full-array copy: must be dropped, not migrated
        tx.objectStore('orders').put({ data: mk(3, 'v3'), timestamp: ts, storeId: 's1' }, 's1');
        tx.objectStore('customers').put(
          { data: mk(2, 'cust'), timestamp: ts, storeId: 's1' },
          's1'
        );
        tx.objectStore('offline_queue').put({ data: ['q'], timestamp: ts, storeId: 'q' }, 'q');
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });

    let m = await load();
    const first = await m.getCollection('orders', 's1_recent', DAY);
    expect(first).toEqual(mk(3, 'v3'));
    expect(await m.getCollection('customers', 's1', DAY)).toEqual(mk(2, 'cust'));
    expect(await m.getCollection('orders', 's1', DAY)).toBeNull();
    expect(await m.getFromCache('offline_queue', 'q', DAY)).toEqual(['q']);

    // Re-open (same version => no second upgrade) and re-read: identical, no duplication.
    m = await load();
    expect(await m.getCollection('orders', 's1_recent', DAY)).toEqual(first);
    expect(await m.getCollection('customers', 's1', DAY)).toHaveLength(2);
  });
});
