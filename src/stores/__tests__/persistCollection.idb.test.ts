import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach, vi } from 'vitest';

const DAY = 24 * 60 * 60 * 1000;
type Item = { id: number; v: string };
const mk = (n: number): Item[] => Array.from({ length: n }, (_, i) => ({ id: i + 1, v: 'a' }));

// Real IndexedDB behind persistCollection: checks which path (delta vs full save) was taken
// and that either way the persisted state equals `next`.
async function setup() {
  vi.resetModules();
  const idb = await import('../../utils/indexedDBCache');
  const { persistCollection } = await import('../cache/persist');
  const save = vi.spyOn(idb, 'saveCollection');
  const delta = vi.spyOn(idb, 'applyCollectionDelta');
  return { idb, persistCollection, save, delta };
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

describe('persistCollection against IndexedDB', () => {
  it('<= 25% changed uses the delta path and persists exactly `next`', async () => {
    const { idb, persistCollection, save, delta } = await setup();
    const prev = mk(100);
    await idb.saveCollection('orders', 's', prev);
    save.mockClear();
    const next = prev.map((p) => (p.id <= 25 ? { ...p, v: 'b' } : p)); // exactly 25%
    await persistCollection('orders', 's', prev, next);
    expect(delta).toHaveBeenCalledTimes(1);
    expect(save).not.toHaveBeenCalled();
    expect(await idb.getCollection('orders', 's', DAY)).toEqual(next);
  });

  it('> 25% changed falls back to a full save that also drops stale records', async () => {
    const { idb, persistCollection, save, delta } = await setup();
    const prev = mk(100);
    await idb.saveCollection('orders', 's', prev);
    save.mockClear();
    const next = prev
      .filter((p) => p.id > 10) // 10 deletions
      .map((p) => (p.id <= 30 ? { ...p, v: 'b' } : p)); // 20 updates => 30% changed
    await persistCollection('orders', 's', prev, next);
    expect(save).toHaveBeenCalledTimes(1);
    expect(delta).not.toHaveBeenCalled();
    const got = (await idb.getCollection<Item>('orders', 's', DAY))!;
    expect(got).toEqual(next);
    expect(got.some((x) => x.id <= 10)).toBe(false);
  });
});
