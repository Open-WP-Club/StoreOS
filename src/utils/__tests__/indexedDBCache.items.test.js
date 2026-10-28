import { vi, describe, it, expect, beforeEach } from 'vitest';

// Minimal in-memory IndexedDB fake (just what indexedDBCache.ts uses).
function installFakeIDB(initial) {
  const db = initial ?? { version: 0, stores: new Map() };
  class Range {
    constructor(lo, hi, loOpen, hiOpen) {
      Object.assign(this, { lo, hi, loOpen, hiOpen });
    }
    has(k) {
      return (
        (this.loOpen ? k > this.lo : k >= this.lo) && (this.hiOpen ? k < this.hi : k <= this.hi)
      );
    }
  }
  global.IDBKeyRange = {
    bound: (lo, hi, loOpen = false, hiOpen = false) => new Range(lo, hi, loOpen, hiOpen),
  };
  const req = (fn) => {
    const r = {};
    queueMicrotask(() => {
      try {
        r.result = fn(r);
        r.onsuccess?.({ target: r });
      } catch (e) {
        r.error = e;
        r.onerror?.();
      }
    });
    return r;
  };
  const makeStore = (name) => {
    const s = db.stores.get(name);
    const sorted = (range) =>
      [...s.data.entries()]
        .filter(([k]) => !range || range.has(k))
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return {
      put: (v, k) => req(() => void s.data.set(s.keyPath ? v[s.keyPath] : k, structuredClone(v))),
      get: (k) => req(() => s.data.get(k)),
      delete: (k) => req(() => void s.data.delete(k)),
      clear: () => req(() => void s.data.clear()),
      getAll: (range, n) => req(() => sorted(range).slice(0, n).map(([, v]) => v)),
      getAllKeys: (range) => req(() => sorted(range).map(([k]) => k)),
      openCursor: () => {
        const entries = sorted();
        let i = 0;
        const r = {};
        const step = () =>
          queueMicrotask(() => {
            const e = entries[i];
            r.result = e
              ? {
                  key: e[0],
                  value: e[1],
                  delete: () => void s.data.delete(e[0]),
                  continue: () => {
                    i++;
                    step();
                  },
                }
              : null;
            r.onsuccess?.({ target: r });
          });
        step();
        return r;
      },
    };
  };
  const makeDb = () => ({
    objectStoreNames: { contains: (n) => db.stores.has(n) },
    createObjectStore: (n, opts) => db.stores.set(n, { keyPath: opts?.keyPath, data: new Map() }),
    deleteObjectStore: (n) => db.stores.delete(n),
    close: () => {},
    transaction: () => {
      const tx = {
        objectStore: (n) => makeStore(n),
        objectStoreNames: { contains: (n) => db.stores.has(n) },
      };
      setTimeout(() => tx.oncomplete?.(), 0);
      return tx;
    },
  });
  global.indexedDB = {
    open: (_n, version) => {
      const r = { result: makeDb() };
      setTimeout(() => {
        if (db.version < version) {
          const oldVersion = db.version;
          db.version = version;
          r.transaction = makeDb().transaction();
          r.onupgradeneeded?.({ target: r, oldVersion });
        }
        setTimeout(() => r.onsuccess?.(), 0);
      }, 0);
      return r;
    },
    deleteDatabase: () => ({}),
  };
  return db;
}

const fresh = () => {
  vi.resetModules();
  return import('../indexedDBCache');
};
const mk = (n) => Array.from({ length: n }, (_, i) => ({ id: i + 1, v: i }));

describe('indexedDBCache per-item collections', () => {
  beforeEach(() => {
    installFakeIDB();
  });

  it('round-trips more than one chunk in original order', async () => {
    const { saveCollection, getCollection } = await fresh();
    const items = mk(1234);
    expect(await saveCollection('orders', 's1_recent', items)).toBe(true);
    expect(await getCollection('orders', 's1_recent', 60000)).toEqual(items);
  });

  it('keeps scopes isolated and returns null for unknown / expired scopes', async () => {
    const { saveCollection, getCollection } = await fresh();
    await saveCollection('orders', 's1_recent', mk(3));
    await saveCollection('orders', 's2_recent', mk(2));
    expect(await getCollection('orders', 's2_recent', 60000)).toHaveLength(2);
    expect(await getCollection('orders', 's3_recent', 60000)).toBeNull();
    await new Promise((r) => setTimeout(r, 5));
    expect(await getCollection('orders', 's1_recent', 1)).toBeNull();
  });

  it('full save removes records that are no longer present', async () => {
    const { saveCollection, getCollection } = await fresh();
    await saveCollection('products', 's1_old', mk(5));
    await saveCollection('products', 's1_old', mk(2));
    expect((await getCollection('products', 's1_old', 60000)).map((p) => p.id)).toEqual([1, 2]);
  });

  it('applyCollectionDelta puts and deletes single items without rewriting others', async () => {
    const db = installFakeIDB();
    const { saveCollection, applyCollectionDelta, getCollection } = await fresh();
    await saveCollection('orders', 's1_recent', mk(4));
    const before = db.stores.get('orders_items').data.get('s1_recent:1');
    await applyCollectionDelta(
      'orders',
      's1_recent',
      [{ item: { id: 2, v: 'new' }, index: 1 }],
      [3]
    );
    expect(db.stores.get('orders_items').data.get('s1_recent:1')).toBe(before);
    const out = await getCollection('orders', 's1_recent', 60000);
    expect(out.map((o) => o.id)).toEqual([1, 2, 4]);
    expect(out[1].v).toBe('new');
  });

  it('clearCacheStore wipes items and metadata', async () => {
    const { saveCollection, getCollection, clearCacheStore } = await fresh();
    await saveCollection('customers', 's1', mk(3));
    await clearCacheStore('customers');
    expect(await getCollection('customers', 's1', 60000)).toBeNull();
  });

  it('migrates v3 whole-array blobs to per-item records', async () => {
    const ts = Date.now();
    const blob = (data) => ({ data, timestamp: ts, storeId: 'x' });
    const legacy = (data) => ({ keyPath: undefined, data });
    const db = {
      version: 3,
      stores: new Map([
        [
          'orders',
          legacy(
            new Map([
              ['s1', blob(mk(4))], // redundant full copy: dropped
              ['s1_recent', blob(mk(2))],
              ['s1_old', blob([{ id: 9 }])],
            ])
          ),
        ],
        [
          'products',
          legacy(
            new Map([
              ['s1_lastSync', blob('2024-01-01')],
              ['s1_recent', blob(mk(1))],
            ])
          ),
        ],
        ['customers', legacy(new Map([['s1', blob(mk(3))]]))],
        ['coupons', legacy(new Map())],
        ['offline_queue', legacy(new Map([['q', blob([{ id: 'a' }])]]))],
      ]),
    };
    installFakeIDB(db);
    const { getCollection, getFromCache } = await fresh();

    expect(await getCollection('orders', 's1_recent', 60000)).toEqual(mk(2));
    expect(await getCollection('orders', 's1_old', 60000)).toEqual([{ id: 9 }]);
    expect(await getCollection('customers', 's1', 60000)).toEqual(mk(3));
    expect(await getCollection('products', 's1_recent', 60000)).toEqual(mk(1));
    // scalars and unrelated stores are untouched; redundant full blob is gone
    expect(await getFromCache('products', 's1_lastSync', 60000)).toBe('2024-01-01');
    expect(await getFromCache('offline_queue', 'q', 60000)).toEqual([{ id: 'a' }]);
    expect(db.stores.get('orders').data.has('s1')).toBe(false);
    expect(db.version).toBe(4);
  });
});
